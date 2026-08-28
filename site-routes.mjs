export const PRIMARY_ROUTES = Object.freeze([
  {
    key: 'home',
    path: '/',
    title: 'Alana Wina Trudi | Borneo Beadwork for Contemporary Retail',
    description: 'Bring living Borneo beadwork to contemporary retail: hand-beaded bags, jewellery, décor, beaded table runners and small accessories from Kampung Manik, Samarinda. Wholesale only.',
    ogImage: '/og-1200x630.jpg',
    kind: 'primary'
  },
  {
    key: 'collection',
    path: '/collection',
    title: 'Collection | Hand-beaded Borneo Craft | Alana Wina Trudi',
    description: 'Explore 56 hand-beaded bags, jewellery, décor, beaded table runners and small accessories from Kampung Manik, Samarinda. Wholesale collection for independent retailers.',
    ogImage: '/og-1200x630.jpg',
    kind: 'primary'
  },
  {
    key: 'motifs',
    path: '/motifs',
    title: 'Motifs & Meaning | Dayak Beadwork | Alana Wina Trudi',
    description: 'Learn how Dayak beadwork uses cosmology, colour, figure and form — with cultural context written for contemporary retail and product storytelling.',
    ogImage: '/og-1200x630.jpg',
    kind: 'primary'
  },
  {
    key: 'wholesale',
    path: '/wholesale',
    title: 'Wholesale Borneo Beadwork | Alana Wina Trudi',
    description: 'Explore the wholesale process for hand-beaded Borneo craft: line sheet, samples, order terms, landed cost, shipping and export documentation.',
    ogImage: '/og-1200x630.jpg',
    kind: 'primary'
  },
  {
    key: 'about',
    path: '/our-makers',
    title: 'Our Makers | Kampung Manik Bead Village',
    description: 'Meet the people and place behind Alana Wina Trudi: hand-beaded Dayak visual language made with beading groups in Kampung Manik, Samarinda.',
    ogImage: '/og-1200x630.jpg',
    kind: 'primary'
  },
  {
    key: 'contact',
    path: '/contact',
    title: 'Contact | Alana Wina Trudi Wholesale',
    description: 'Contact Alana Wina Trudi in Samarinda for the current wholesale line sheet, product range and order information.',
    ogImage: '/og-1200x630.jpg',
    kind: 'primary'
  },
  {
    key: 'privacy',
    path: '/privacy',
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
    title: `${category.name} Collection | Alana Wina Trudi`,
    description: category.description,
    ogImage: category.image,
    kind: 'category',
    category
  };
}

function productRoute(product, catalogue) {
  const category = catalogue.categories.find(x => x.id === product.categoryId);
  if (!category) throw new Error(`Unknown category ${product.categoryId} for ${product.id}`);
  return {
    key: `product-${product.id}`,
    path: productPath(product, catalogue),
    title: `${product.name} | Alana Wina Trudi`,
    description: product.description,
    ogImage: product.image,
    kind: 'product',
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
