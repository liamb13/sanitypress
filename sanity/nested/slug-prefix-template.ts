import { Template } from 'sanity'

export const slugPrefixTpl = (
	schemaType: string,
	title?: string,
): Template<any, any> => {
	return {
		id: `${schemaType}-with-initial-slug`,
		title: title || `create new ${schemaType}`,
		schemaType: schemaType,
		parameters: [
			{ name: `parentId`, title: `Parent ID`, type: `string` },
			{ name: 'parentSlug', title: 'Parent Slug', type: 'string' },
		],
		value: ({
			parentId,
			parentSlug,
		}: {
			parentId: string
			parentSlug: string
		}) => {
			return {
				parent: { _type: 'reference', _ref: parentId },
				slug: { _type: 'string', current: parentSlug + '/' },
			}
		},
	}
}
