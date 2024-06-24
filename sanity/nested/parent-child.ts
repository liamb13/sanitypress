import { isEqual } from 'lodash-es'
import { AddCircleIcon, AddIcon, EditIcon, FolderIcon } from '@sanity/icons'

import { Observable, distinctUntilChanged, map, switchMap } from 'rxjs'
import type { DocumentStore, ListenQueryOptions, SanityDocument } from 'sanity'
import { ItemChild, ListBuilder, StructureBuilder } from 'sanity/structure'

import { apiVersion } from '../src/env'

import { uuid } from '@sanity/uuid'

export default function parentChild(
	schemaType: string = 'yourSchemaType',
	S: StructureBuilder,
	documentStore: DocumentStore,
	labels: {
		multiple: string
		single: string
	} = { multiple: 'Pages', single: 'Page' },
) {
	const newDraftFilter = `(!(_id in path("drafts.**")) || _id in path("drafts.**") && count(*[^._id == "drafts." + _id]) == 0)`
	const filterWithoutParent = `_type == "${schemaType}"&& !defined(parent) && !(_id in path("drafts.**"))`
	const filterAll = `_type == "${schemaType}" && ${newDraftFilter}`
	const filterPublished = `_type == "${schemaType}" && !(_id in path("drafts.**"))`
	const filterDrafts = `_type == "${schemaType}" && _id in path("drafts.**") && count(*[^._id == "drafts." + _id]) == 0`
	const query = `*[${filterWithoutParent}]{ _id, title, metadata { slug } }`
	const queryId = (id: string) =>
		`*[${filterAll} && _id == "${id}"][0]{ _id, title, metadata { slug }, parent, children }`

	const options: ListenQueryOptions = { apiVersion: `2023-01-01` }

	return S.listItem()
		.title(labels.multiple)
		.child(() =>
			documentStore.listenQuery(query, {}, options).pipe(
				distinctUntilChanged(isEqual),
				map((parents) =>
					S.list()
						.title(labels.multiple)
						.menuItems([
							S.menuItem()
								.title('Add')
								.icon(AddIcon)
								.intent({ type: 'create', params: { type: schemaType } }),
						])
						.items([
							// Create a List Item for all documents
							// Useful for searching
							S.listItem()
								.id('all')
								.title(`All ${labels.multiple}`)
								.schemaType(schemaType)
								.child(() =>
									S.documentList()
										.schemaType(schemaType)
										.title(`All ${labels.multiple}`)
										.canHandleIntent(
											(intentName, params) =>
												['create', 'edit'].includes(intentName) &&
												params.template === schemaType &&
												params.type === schemaType,
										)
										.apiVersion(apiVersion)
										.filter(filterAll)
										.child((id) =>
											S.document().documentId(id).schemaType(schemaType),
										),
								),
							S.listItem()
								.id('drafts')
								.title(`Draft ${labels.multiple}`)
								.schemaType(schemaType)
								.child(() =>
									S.documentList()
										.schemaType(schemaType)
										.title(`Draft ${labels.multiple}`)

										.canHandleIntent(
											(intentName, params) =>
												['create', 'edit'].includes(intentName) &&
												params.template === schemaType &&
												params.type === schemaType,
										)
										.apiVersion(apiVersion)
										.filter(filterDrafts)
										.child((id) =>
											S.document().documentId(id).schemaType(schemaType),
										),
								),
							S.divider(),
							// Create a New Item for the schema
							S.listItem()
								.id('create')
								.title(`New ${labels.single}`)
								.icon(AddCircleIcon)
								.child(
									S.document()
										.id(uuid())
										.schemaType(schemaType)
										.views([S.view.form()]),
								),

							...parents.map(
								(
									parent: SanityDocument & {
										title: string
										metadata?: { slug?: { current: string } }
									},
								) =>
									S.listItem({
										id: parent._id.replace('drafts.', ''),
										title: parent.title,
										schemaType,
										child: () =>
											S.documentTypeList(schemaType)
												.title(`${parent.title} ${labels.multiple}`)
												.filter(
													`_type == $schemaType && (string::startsWith(metadata.slug.current, $parentSlug) || $parentId == _id)`,
												)
												.params({
													schemaType,
													parentId: parent._id,
													parentSlug:
														parent?.metadata?.slug?.current || 'undefined',
												})
												.defaultOrdering([
													{ field: 'metadata.slug.current', direction: 'asc' },
												])
												// Use this list for creating from child menu
												.canHandleIntent(
													(intentName, params) =>
														intentName === 'create' &&
														params.template ===
															`${schemaType}-with-initial-slug`,
												)
												.initialValueTemplates([
													S.initialValueTemplateItem(
														`${schemaType}-with-initial-slug`,
														{
															parentId: parent?._id.replace('drafts.', ''),
															parentSlug: parent?.metadata?.slug?.current,
														},
													),
												]),
									}),
							),
						]),
				),
			),
		)
}
