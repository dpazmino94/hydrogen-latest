import {json} from '@shopify/remix-oxygen';

export async function loader({context, params}) {
  const {cart} = context;
  const cartObject = await cart.get()

  
  return {
    "token": "00fb6e84b4917cfb5246b00e5061478a",
    "note": null,
    "attributes": {
      "_isLoggedInToShopRunner": "true",
      "_srToken": "23381ac3e4a24f689b6501ad8bb4bc69"
    },
    "original_total_price": 5000,
    "total_price": 5000,
    "total_discount": 0,
    "total_weight": 3629,
    "item_count": 1,
    "items": [
      {
        "id": 44894561108268,
        "properties": {
          "_isLoggedInToShopRunner": "true"
        },
        "quantity": 1,
        "variant_id": 44894561108268,
        "key": "44894561108268:cfabcc3587f4a304a242a71648bdedf8",
        "title": "Example T-Shirt - SR - Lithograph - Height: 9&quot; x Width: 12&quot;",
        "price": 5000,
        "original_price": 5000,
        "presentment_price": 50,
        "discounted_price": 5000,
        "line_price": 5000,
        "original_line_price": 5000,
        "total_discount": 0,
        "discounts": [],
        "sku": null,
        "grams": 3629,
        "vendor": "Acme",
        "taxable": true,
        "product_id": 8256294617388,
        "product_has_only_default_variant": false,
        "gift_card": false,
        "final_price": 5000,
        "final_line_price": 5000,
        "url": "/products/example-t-shirt?variant=44894561108268",
        "featured_image": {
          "aspect_ratio": 1.499,
          "alt": "Example T-Shirt - SR",
          "height": 3335,
          "url": "https://cdn.shopify.com/s/files/1/0676/4203/2428/products/green-t-shirt.jpg?v=1681140282",
          "width": 5000
        },
        "image": "https://cdn.shopify.com/s/files/1/0676/4203/2428/products/green-t-shirt.jpg?v=1681140282",
        "handle": "example-t-shirt",
        "requires_shipping": true,
        "product_type": "Shirts",
        "product_title": "Example T-Shirt - SR",
        "product_description": "",
        "variant_title": "Lithograph - Height: 9\" x Width: 12\"",
        "variant_options": [
          "Lithograph - Height: 9\" x Width: 12\""
        ],
        "options_with_values": [
          {
            "name": "Title",
            "value": "Lithograph - Height: 9\" x Width: 12\""
          }
        ],
        "line_level_discount_allocations": [],
        "line_level_total_discount": 0,
        "quantity_rule": {
          "min": 1,
          "max": null,
          "increment": 1
        },
        "has_components": false
      }
    ],
    "requires_shipping": true,
    "currency": "USD",
    "items_subtotal_price": 5000,
    "cart_level_discount_applications": []
  }
  console.log(params.func, 'GET');
  console.log(Object.keys(cart));
  return json(await cart.get());
}

export async function action({context, params, request}) {
//updateAttributes
const {cart} = context;
console.log(params.func, 'POST');
const jsonTemp = await request.json()
console.log(jsonTemp, 'POST');

return json(await cart.updateAttributes(
  [
    {
      key: 'Somekey',
      value: '1',
    },
  ],
));

}
