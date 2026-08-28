export const PRIMARY_ROUTES = Object.freeze([
  {
    key: 'home',
    path: '/',
    heading: 'We believe Borneo beadwork belongs in contemporary life.',
    title: 'Alana Wina Trudi | Borneo Beadwork for Contemporary Retail',
    description: 'Bring living Borneo beadwork to contemporary retail: hand-beaded bags, jewellery, décor, beaded table runners and small accessories from Kampung Manik, Samarinda. Wholesale only.',
    ogImage: '/og-1200x630.jpg',
    kind: 'primary'
  },
  {
    key: 'collection',
    path: '/collection',
    heading: 'Hand-beaded pieces for contemporary retail',
    title: 'Collection | Hand-beaded Borneo Craft | Alana Wina Trudi',
    description: 'Explore hand-beaded bags, jewellery, décor, beaded table runners and small accessories from Kampung Manik, Samarinda. Wholesale collection for independent retailers.',
    ogImage: '/og-1200x630.jpg',
    kind: 'primary'
  },
  {
    key: 'motifs',
    path: '/motifs',
    heading: 'How to read the beadwork',
    title: 'Motifs & Meaning | Dayak Beadwork | Alana Wina Trudi',
    description: 'Learn how Dayak beadwork uses cosmology, colour, figure and form — with cultural context written for contemporary retail and product storytelling.',
    ogImage: '/og-1200x630.jpg',
    kind: 'primary'
  },
  {
    key: 'wholesale',
    path: '/wholesale',
    heading: 'Wholesale for retailers who want a line with a point of view',
    title: 'Wholesale Borneo Beadwork | Alana Wina Trudi',
    description: 'Send a wholesale enquiry about hand-beaded Borneo craft, samples, ordering, shipping and export documentation.',
    ogImage: '/og-1200x630.jpg',
    kind: 'primary'
  },
  {
    key: 'about',
    path: '/our-makers',
    heading: 'Kampung Manik, the Bead Village',
    title: 'Our Makers | Kampung Manik Bead Village',
    description: 'Meet the people and place behind Alana Wina Trudi: hand-beaded Dayak visual language made with beading groups in Kampung Manik, Samarinda.',
    ogImage: '/og-1200x630.jpg',
    kind: 'primary'
  },
  {
    key: 'contact',
    path: '/contact',
    heading: 'Let’s find the right line for your shelves',
    title: 'Contact | Alana Wina Trudi Wholesale',
    description: 'Contact Alana Wina Trudi in Samarinda with a wholesale enquiry about the current product range and order information.',
    ogImage: '/og-1200x630.jpg',
    kind: 'primary'
  },
  {
    key: 'privacy',
    path: '/privacy',
    heading: 'Privacy',
    title: 'Privacy | Alana Wina Trudi',
    description: 'Read how Alana Wina Trudi handles information submitted through this wholesale website.',
    ogImage: '/og-1200x630.jpg',
    kind: 'primary'
  }
]);

export function categoryPath(category) {
  return `/collection/${category.slug}`;
}

export function productPath(product, catalogue) {
  const category = catalogue.categories.find(x => x.id === product.categoryId);
  if (!category) throw new Error(`Unknown category ${product.categoryId} for ${product.id}`);
  return `/collection/${category.slug}/${product.slug}`;
}

function categoryRoute(category) {
  return {
    key: `category-${category.id}`,
    path: categoryPath(category),
    heading: category.name,
    title: `${category.name} Collection | Alana Wina Trudi`,
    description: category.description,
    ogImage: category.image,
    ogImageAlt: category.alt,
    kind: 'category',
    categoryId: category.id,
    category
  };
}

function productRoute(product, catalogue) {
  const category = catalogue.categories.find(x => x.id === product.categoryId);
  if (!category) throw new Error(`Unknown category ${product.categoryId} for ${product.id}`);
  return {
    key: `product-${product.id}`,
    path: productPath(product, catalogue),
    heading: product.name,
    title: `${product.name} | Alana Wina Trudi`,
    description: product.description,
    ogImage: product.image,
    ogImageAlt: product.alt,
    kind: 'product',
    categoryId: category.id,
    productId: product.id,
    category,
    product
  };
}

export function allIndexableRoutes(catalogue) {
  const active = catalogue.products.filter(x => x.status === 'active');
  return [
    ...PRIMARY_ROUTES,
    ...catalogue.categories.map(categoryRoute),
    ...active.map(product => productRoute(product, catalogue))
  ];
}
