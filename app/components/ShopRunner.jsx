export function ShopRunner({nonce}) {
    let partnerCode = 'SHOPIFYDEV'
    let environment = 'staging'
    let pageType = 'product' // TODO: Review a way for getting the page type
    let js = `
    import { getPageType, lgr, initShopRunner } from 'https://web-assets-stg.s3.amazonaws.com/@shoprunner/shopify@latest/shoprunner.min.js'
    const srPartnerCode = '${partnerCode}'
    const environment = '${environment}'
    const initPageType = '${pageType}'
    lgr.log('pageType:', initPageType)
    // settings for web components
    const themeConfig = {
      dynamicPaymentButtonModalMessage: 'Thanks for being a ShopRunner member! Please enter your email address to enable ShopRunner Free Shipping in checkout',
      addToCartSelector: 'button[name="add"]',
      paymentButtonContainerSelector: 'div[data-shopify="payment-button"]',//
      paymentButtonSelector: 'button.shopify-payment-button__button',//
      shippingMethodsContainerSelector: 'div[data-step="shipping_method"] .section__content',//
      shippingSelector: 'span[data-shipping-method-label-title="<serviceName>"]',//
      payMethodContainerSelector: 'div[data-step="payment_method"]',//
      payMethodSelector: 'div[data-review-section="shipping-cost"]',//
      pdpBenefitsAccessSelector: 'body > main > div > div.product-main > h1',
      pdpVariantIdHiddenInputSelector: 'form[action="/cart/add"] input[data-variant-id][name="quantity"]',
      eligibilityContainerSelectors: [
        {
          productSelector: 'div.product-block.product-block--header > h1', // product (pdp)
          locationMethod: 'closest',
          locationSelector: 'div.product-block.product-block--header > h1',
          placementMethod: 'after',
          pageTypes: ['product'],
          pageTypesExcluded: []
        },
        {
          productSelector: 'div.grid-product__content > a', // collection (any collection, e.g., collection page, featured products, search results)
          locationMethod: "closest",
          locationSelector: 'div',
          locationSelectorChild: 'div.grid-product__price',
          pageTypes: [],
          pageTypesExcluded: ['product'],
          placementMethod: 'after',
        },
        {
          productSelector: '#cart-drawer > div.cart-drawer__body > div.cart-drawer__items.aos-init.aos-animate > div > div.cart__item__content > div.cart__item__content-inner > div > p > a', // cart page and cart drawer (not notification popup; see below)
          locationMethod: 'closest',
          locationSelector: 'p',
          placementMethod: 'after',
        },
        {
          productSelector: '#cart-drawer > div.cart-drawer__body > div.cart-drawer__items.aos-init.aos-animate > div > div.cart__item__content > div.cart__item__content-inner > div > p > a', // cart notification popup on pdp
          locationMethod: 'closest',
          locationSelector: 'p',
          placementMethod: 'after',
          pageTypes: ['product'],
        },      
      ]
    }
    // settings for app environment
    const appConfig = {
      logLevel: (environment === 'production') ? 1 : 3, // 0: no output, 1: errors, 2: errors, warnings, 3: errors, warnings, logs
      shopRunnerValidationUrl: ((environment === 'production') ? 'https://connector.shoprunner.com' : 'https://shopifyconnector.wip.shoprunner.io') + '/validate'
    }
    // init function
    initShopRunner(srPartnerCode, initPageType, themeConfig, appConfig)
    `

    return (
        <script type="module" nonce={nonce} suppressHydrationWarning={true} dangerouslySetInnerHTML={{__html: js}} />
    )
}
