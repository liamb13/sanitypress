import { defineArrayMember, defineField, defineType } from 'sanity'

export default defineType({
	name: 'page',
	title: 'Page',
	type: 'document',
	fields: [
		defineField({
			name: 'parent',
			type: 'reference',
			to: [{ type: 'page' }],
		}),
		defineField({
			name: 'children',
			type: 'array',
			of: [defineArrayMember({ type: 'string' })],
			hidden: true,
		}),
		defineField({
			name: 'title',
			type: 'string',
		}),
		defineField({
			name: 'modules',
			type: 'array',
			of: [
				{ type: 'accordion-list' },
				{ type: 'blog-list' },
				{ type: 'breadcrumbs' },
				{ type: 'callout' },
				{ type: 'creative-module' },
				{ type: 'custom-html' },
				{ type: 'flag-list' },
				{ type: 'hero' },
				{ type: 'hero.saas' },
				{ type: 'hero.split' },
				{ type: 'logo-list' },
				{ type: 'pricing-list' },
				{ type: 'richtext-module' },
				{ type: 'stat-list' },
				{ type: 'step-list' },
				{ type: 'testimonial-list' },
				{ type: 'testimonial.featured' },
			],
		}),
		defineField({
			name: 'metadata',
			type: 'metadata',
		}),
	],
	orderings: [
		{
			name: 'slug',
			title: 'Slug',
			by: [{ field: 'metadata.slug.current', direction: 'asc' }],
		},
		{
			name: 'title.asc',
			title: 'Title (A-Z)',
			by: [{ field: 'title', direction: 'asc' }],
		},
		{
			name: 'title.desc',
			title: 'Title (Z-A)',
			by: [{ field: 'title', direction: 'desc' }],
		},
	],
	preview: {
		select: {
			title: 'title',
			slug: 'metadata.slug.current',
			media: 'metadata.image',
		},
		prepare: ({ title, slug }) => ({
			title,
			subtitle: slug && (slug === 'index' ? '/' : `/${slug}`),
		}),
	},
})
