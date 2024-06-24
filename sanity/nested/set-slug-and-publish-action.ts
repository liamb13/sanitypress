import groq from 'groq'
import { isEqual } from 'lodash-es'
import { useState, useEffect } from 'react'
import {
	DocumentActionDescription,
	DocumentActionProps,
	useClient,
	useDocumentOperation,
} from 'sanity'
import slugify from './slugify'

export function SetSlugAndPublishAction(
	props: DocumentActionProps,
): DocumentActionDescription {
	const doc = props.draft || props.published
	const { patch, publish } = useDocumentOperation(props.id, props.type)
	const [isPublishing, setIsPublishing] = useState(false)

	useEffect(() => {
		// if the isPublishing state was set to true and the draft has changed
		// to become `null` the document has been published
		if (isPublishing && !props.draft) {
			setIsPublishing(false)
		}
	}, [isPublishing, props.draft])

	const client = useClient({ apiVersion: '2021-03-25' })

	const getAncestorSlugs = async (parentId: string) => {
		if (!parentId) return ''

		let id: string | null = parentId,
			slugs: string[][] = []

		while (Boolean(id)) {
			const parent: any = await client.fetch(
				groq`*[_id == "${id}"][0]{metadata{slug}, parent}`,
			)
			const parentSlug = parent?.metadata?.slug?.current as string
			const grandParentRef = parent?.parent?._ref

			if (parentSlug) {
				slugs.unshift(parentSlug.split('/').filter(Boolean))
			}
			if (grandParentRef) {
				id = grandParentRef
			} else {
				return [...new Set(slugs.flat())].join('/')
			}
		}
	}

	const getChildren = async (
		id: string,
		schemaType: string,
	): Promise<string[] | []> => {
		if (!id) return []
		const children: any = await client.fetch(
			groq`*[_type == "${schemaType}" && parent._ref == "${id}"]{_id}`,
		)
		return children.map((child: { _id: string }) => child._id)
	}

	const updateParentsChildren = async (
		parentId: string,
		childId: string,
		schemaType: string,
	) => {
		if (!parentId || !childId) return null
		const parent: any = await client.fetch(
			groq`*[_type == "${schemaType}" && _id == "${parentId}"][0]{_id, children}`,
		)

		if (!parent) return null
		const childIsPresent = parent.children?.some((id: string) => id === childId)
		if (childIsPresent) return null

		const oldChildren = parent.children?.filter(Boolean)
		const newChildren = parent.children?.length
			? [...oldChildren, childId]
			: [childId]

		const patch = client.patch(parent._id).set({ children: newChildren })
		return await patch.commit().then(console.log).catch(console.error)
	}

	const setNewSlugForChild = async (
		id: string,
		slugifiedDraftTitle: string,
		slugifiedPublishedTitle: string,
		schemaType: string,
	) => {
		if (!id) return

		const children: any = await client.fetch(
			groq`*[_type == "${schemaType}" && (_id == "${id}" || _id == "drafts.${id}")]{_id, metadata{slug}, children}`,
		)

		if (!children.length) return

		children.forEach(
			async (child: {
				_id: string
				metadata: {
					slug: { current: string }
				}
				children: string[]
			}) => {
				let newSlug = child.metadata.slug.current.replace(
					slugifiedPublishedTitle,
					slugifiedDraftTitle,
				)

				const patch = client.patch(id).set({
					metadata: {
						slug: {
							current: newSlug,
						},
					},
				})

				if (child.children?.length) {
					child.children.forEach((childId: string) =>
						setNewSlugForChild(
							childId,
							slugifiedDraftTitle,
							slugifiedPublishedTitle,
							schemaType,
						),
					)
				}

				return await patch.commit().then(console.log).catch(console.error)
			},
		)
	}

	return {
		disabled: Boolean(publish.disabled),
		label: isPublishing ? 'Publishing…' : 'Publish & Update',
		onHandle: async () => {
			try {
				// This will update the button text
				setIsPublishing(true)
				// Set slug
				// @ts-ignore
				let parentsSlug = doc?.metadata?.slug?.current || ''
				// @ts-ignore
				const parentId = doc?.parent?._ref || ''

				const ancestors = await getAncestorSlugs(parentId)
				const schemaType = doc?._type

				parentsSlug = ancestors
				if (parentsSlug) {
					parentsSlug += '/'
				}

				const newSlug = `${parentsSlug}${slugify(doc!.title as string)}`

				patch.execute([
					{
						set: {
							metadata: {
								slug: {
									_type: 'slug',
									current: newSlug,
								},
							},
						},
					},
				])

				if (parentId && doc?._id && schemaType) {
					const childId = doc._id.replace('drafts.', '')
					updateParentsChildren(parentId, childId, schemaType)
				}

				if (doc?._id && schemaType) {
					const id = doc._id.replace('drafts.', '')
					const children = await getChildren(id, schemaType)

					if (children?.length) {
						// For each child set new slug, if title has changed
						const slugifiedDraftTitle = slugify(props.draft?.title as string)
						const slugifiedPublishedTitle = slugify(
							props.published?.title as string,
						)

						if (!isEqual(slugifiedDraftTitle, slugifiedPublishedTitle)) {
							children.forEach((childId) =>
								setNewSlugForChild(
									childId,
									slugifiedDraftTitle,
									slugifiedPublishedTitle,
									schemaType,
								),
							)
						}

						// Set children IDs, if new children array is not equal to old one
						if (!isEqual(props.draft?.children, children))
							patch.execute([
								{
									set: {
										children,
									},
								},
							])
					}
				}

				// Perform the publish
				publish.execute()

				// Signal that the action is completed
				props.onComplete()
			} catch (e) {
				console.error(e)
			}
		},
	}
}
