import { Breadcrumbs, type BreadcrumbItem, type BreadcrumbsProps } from '../index'

const items: BreadcrumbItem[] = [{ label: 'Реестры', href: '/registries' }, { label: 'Платежи' }]
const props: BreadcrumbsProps = { items, className: 'trail' }

export const breadcrumbs = <Breadcrumbs {...props} />

// @ts-expect-error Пункту нужна текстовая подпись.
export const unlabeledBreadcrumb = <Breadcrumbs items={[{ href: '/registries' }]} />
