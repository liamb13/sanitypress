import slugify from 'slugify'

export default function (title: string) {
	return slugify(title, {
		lower: true,
		strict: true,
		remove: /[*+~.()'"!:@?]/g,
		trim: true,
	})
}
