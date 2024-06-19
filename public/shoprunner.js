// public/shoprunner-script.js

const partnerCode = 'SHOPIFYDEV';
const environment = 'staging';

// TODO: Add this on production
function getPageTypeTemp(url) {
  const path = new URL(url).pathname;
  const segments = path.split('/').filter(Boolean);
  switch (segments[0]) {
      case 'collections':
          return 'collection';
      case 'products':
      case 'product':
          return 'product';
      case 'cart':
          return 'cart';
      default:
          return 'home';
  }
}
const pageType = getPageTypeTemp(window.location.href);
lgr.log('pageType:', pageType);

import { lgr, initShopRunner } from '/shoprunner-tem.js';

lgr.log('pageType:', pageType);

const themeConfig = {
  dynamicPaymentButtonModalMessage: 'Thanks for being a ShopRunner member! Please enter your email address to enable ShopRunner Free Shipping in checkout',
  addToCartSelector: 'body > main > div > div.product-main > div.product-form > form > button',
  paymentButtonContainerSelector: 'div[data-shopify="payment-button"]',
  paymentButtonSelector: 'button.shopify-payment-button__button',
  shippingMethodsContainerSelector: 'div[data-step="shipping_method"] .section__content',
  shippingSelector: 'span[data-shipping-method-label-title="<serviceName>"]',
  payMethodContainerSelector: 'div[data-step="payment_method"]',
  payMethodSelector: 'div[data-review-section="shipping-cost"]',
  pdpBenefitsAccessSelector: 'body > main > div > div.product-main > h1',
  cartPageBenefitsAccessSelector: 'body > main > div',
  pdpVariantIdHiddenInputSelector: 'form[action="/cart/add"] input[data-variant-id][name="quantity"]',
  shopifyStoreUrl: 'https://shoprunner-demo-01.myshopify.com',
  ajaxCartRoute: '/api/cart',
  eligibilityContainerSelectors: [
    {
      productSelector: 'div.product-main > div.product-price',
      locationMethod: 'closest',
      locationSelector: 'div.product-main > div.product-price',
      placementMethod: 'after',
      pageTypes: ['product'],
      pageTypesExcluded: []
    },
    {
      productSelector: 'a.product-item',
      locationMethod: "closest",
      locationSelector: 'div',
      locationSelectorChild: 'body > main > div > div > a > small',
      pageTypes: [],
      pageTypesExcluded: ['product'],
      placementMethod: 'after',
    },
    {
      productSelector: '#cart-aside > aside > main > div > div.cart-details > div:nth-child(1) > ul > li > div > a',
      locationMethod: 'closest',
      locationSelector: 'div',
      placementMethod: 'after',
    },
    {
      productSelector: '#cart-aside > aside > main > div > div.cart-details > div:nth-child(1) > ul > li > div > a',
      locationMethod: 'closest',
      locationSelector: 'p',
      placementMethod: 'after',
      pageTypes: ['product'],
    },
  ]
};

const appConfig = {
  logLevel: (environment === 'production') ? 1 : 3,
  shopRunnerValidationUrl: ((environment === 'production') ? 'https://connector.shoprunner.com' : 'https://shopifyconnector.wip.shoprunner.io') + '/validate'
};

initShopRunner(partnerCode, pageType, themeConfig, appConfig);
