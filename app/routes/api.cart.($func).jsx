import {json} from '@shopify/remix-oxygen';

function mapHydrogenCartToAjaxCart(hydrogenCart) {
  const attributes = hydrogenCart.attributes.reduce((acc, attribute) => {
    acc[attribute.key] = attribute.value;
    return acc;
  }, {});

  const ajaxCart = {
    token: hydrogenCart.id.split('?key=')[1], // Extract token from ID
    note: hydrogenCart.note,
    attributes,
    original_total_price: parseInt(hydrogenCart.cost.totalAmount.amount) * 100,
    total_price: parseInt(hydrogenCart.cost.totalAmount.amount) * 100,
    // total_discount: 0,
    // total_weight: 3629, // This value needs to be adjusted accordingly
    item_count: hydrogenCart.totalQuantity,
    items: hydrogenCart.lines.nodes.map((item) => ({
      id: parseInt(item.merchandise.id.split('/').pop()),
      // properties: {
      //   _isLoggedInToShopRunner: hydrogenCart.buyerIdentity.customer
      //     ? 'true'
      //     : 'false',
      // },
      quantity: item.quantity,
      variant_id: parseInt(item.merchandise.id.split('/').pop()),
      key: item.id.split('?cart=')[0].split('/').pop(),
      title: item.merchandise.product.title + ' - ' + item.merchandise.title,
      price: parseInt(item.cost.amountPerQuantity.amount) * 100,
      original_price: parseInt(item.cost.amountPerQuantity.amount) * 100,
      presentment_price: parseInt(item.cost.amountPerQuantity.amount),
      discounted_price: parseInt(item.cost.amountPerQuantity.amount) * 100,
      line_price: parseInt(item.cost.totalAmount.amount) * 100,
      original_line_price: parseInt(item.cost.totalAmount.amount) * 100,
      total_discount: 0,
      discounts: [],
      // sku: null, // SKU would need to be added if available
      // grams: 3629, // This value needs to be adjusted accordingly
      vendor: item.merchandise.product.vendor,
      // taxable: true, // Adjust according to actual data
      product_id: parseInt(item.merchandise.product.id.split('/').pop()),
      // product_has_only_default_variant: false, // Adjust according to actual data
      // gift_card: false, // Adjust according to actual data
      final_price: parseInt(item.cost.amountPerQuantity.amount) * 100,
      final_line_price: parseInt(item.cost.totalAmount.amount) * 100,
      url: `/products/${item.merchandise.product.handle}?variant=${parseInt(
        item.merchandise.id.split('/').pop(),
      )}`,
      featured_image: {
        aspect_ratio:
          item.merchandise.image.width / item.merchandise.image.height,
        alt: item.merchandise.image.altText,
        height: item.merchandise.image.height,
        url: item.merchandise.image.url,
        width: item.merchandise.image.width,
      },
      image: item.merchandise.image.url,
      handle: item.merchandise.product.handle,
      requires_shipping: item.merchandise.requiresShipping,
      // product_type: 'Shirts', // Adjust according to actual data
      product_title: item.merchandise.product.title,
      // product_description: '', // Adjust according to actual data
      variant_title: item.merchandise.title,
      variant_options: item.merchandise.selectedOptions.map(
        (option) => option.value,
      ),
      options_with_values: item.merchandise.selectedOptions.map((option) => ({
        name: option.name,
        value: option.value,
      })),
      line_level_discount_allocations: [],
      line_level_total_discount: 0,
      quantity_rule: {
        min: 1,
        max: null,
        increment: 1,
      },
      // has_components: false, // Adjust according to actual data
    })),
    requires_shipping: hydrogenCart.lines.nodes.some(
      (item) => item.merchandise.requiresShipping,
    ),
    currency: hydrogenCart.cost.totalAmount.currencyCode,
    items_subtotal_price:
      parseInt(hydrogenCart.cost.subtotalAmount.amount) * 100,
    cart_level_discount_applications: hydrogenCart.discountCodes,
  };
  console.log('ajaxCart', ajaxCart);
  return ajaxCart;
}

export async function loader({context, params}) {
  const {cart} = context;
  const cartObject = await cart.get();
  const formatedCartData = mapHydrogenCartToAjaxCart(cartObject);
  return formatedCartData;
}

export async function action({context, params, request}) {
  //updateAttributes
  const {cart} = context;
  const {properties} = await request.json();
  if (params.func == 'update.js') return {};
  const result = await cart.updateAttributes([
    {
      key: '_isLoggedInToShopRunner',
      value: properties._isLoggedInToShopRunner,
    },
  ]);
  console.log(params.func, 'POST', result, properties._isLoggedInToShopRunner);

  return result;
}
