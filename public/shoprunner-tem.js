
// external ShopRunner shopping-components bundle
import {
    init,
    serverCallbacks
  } from 'https://assets.prd.shoprunner.io/@shoprunner/shopping@1/es6/index.js'
  
  // dynamic globals
  let pageType
  let suspendCartSync = false
  let memberAuthToken
  const showElementClass = 'sr-visible'
  let themeConfig = {
    dynamicPaymentButtonModalMessage: 'Thanks for being a ShopRunner member! Please enter your email address to enable ShopRunner Free Shipping in checkout',
    addToCartSelector: 'button[name="add"]',
    paymentButtonContainerSelector: 'div[data-shopify="payment-button"]',
    paymentButtonSelector: 'button.shopify-payment-button__button',
    shippingMethodsContainerSelector: 'div[data-step="shipping_method"] .section__content',
    shippingSelector: 'span[data-shipping-method-label-title="<serviceName>"]',
    payMethodContainerSelector: 'div[data-step="payment_method"]',
    payMethodSelector: 'div[data-review-section="shipping-cost"]',
    pdpBenefitsAccessSelector: 'product-info share-button',
    cartPageBenefitsAccessSelector: '#cart',
    pdpVariantIdHiddenInputSelector: 'product-info form[action="/cart/add"] input[name="id"]',
    shopifyStoreUrl: '',
    eligibilityContainerSelectors: [
      {
        productSelector: 'product-info a[href^="/products/"]', // product (pdp)
        locationMethod: 'closest',
        locationSelector: 'product-info',
        locationSelectorChild: 'share-button',
        placementMethod: 'before',
        pageTypes: ['product'],
        pageTypesExcluded: []
      },
      {
        productSelector: '.collection a[href^="/products/"]', // collection (any collection, e.g., collection page, featured products, search results)
        locationMethod: 'closest',
        locationSelector: '.card__information',
        pageTypes: [],
        pageTypesExcluded: ['product']
      },
      {
        productSelector: '.cart-items a[href^="/products/"]', // cart page and cart drawer (not notification popup; see below)
        locationMethod: 'closest',
        locationSelector: '.cart-item__details',
      },
      {
        productSelector: 'product-info a[href^="/products/"]', // cart notification popup on pdp; TODO: support from other pages, e.g., quick add if native to supported theme
        locationMethod: 'closest',
        locationSelector: 'body',
        locationSelectorChild: '.cart-notification-product',
        placementMethod: 'before',
        pageTypes: ['product'],
      },
      {
        productSelector: '#order-summary tr.product', // order summary in checkout -- only for checkout.liquid
        locationMethod: 'querySelector',
        locationSelector: '.product__description',
        pageTypes: ['checkout', 'shipping', 'payment', 'order confirmation'],
      }
    ]
  }
  
  let appConfig = {
    logLevel: 3, // 1 = errors, 2 = errors, warnings, 3 = errors, warnings, logs
    shopRunnerValidationUrl: 'https://connector-stg.shoprunner.com/validate',
  }
  
  // static globals
  const theme = window.theme || {}
  const shopRunnerTag = 'shoprunner'
  const loggedInPrp = '_isLoggedInToShopRunner'
  const memberAuthTokenPrp = '_srToken'
  const twoDayShippingServiceName = 'ShopRunner Free 2-Day Shipping'
  const groundShippingServiceName = 'ShopRunner Free Ground Shipping'
  const appProxyBasePath = '/apps/shoprunner'
  const dynamicCheckoutUrl = `${appProxyBasePath}/api/shopify/proxy/dynamic-checkout`
  const cartRequestHeaders = { 'Content-Type': 'application/json' }
  
  // shoprunner components
  /*
    currently in use:
      Benefits Access: 'sr-benefits' // "SHOPRUNNER FREE 2-Day Shipping & Free Returns. <login link>"
      Header: 'sr-header' // "SHOPRUNNER FREE 2-Day Shipping & Free Returns. <login link>" (identical in content to Benefits Access; is behavior different?)
      Checkout Page: 'sr-checkout' // "Thanks for being a ShopRunner member!"
      Checkout Page Shipping: 'sr-checkout-page-shipping' // "Thanks for being a ShopRunner member!"
      Dual Eligibility: 'sr-dual-eligibility' // "SHOPRUNNER Some items may not be ligible for free 2-day shipping. If your cart contains ineligible items we will profide Free Standard Shipping for this order. <login link>"
      Static Shipping Options: 'sr-static-ship-options' // Get it by <date> with FREE 2-Day Shipping."
      Eligible Badge: 'sr-eligible' // Eligible
  */
  const srLoginElmNames = ['sr-benefits', 'sr-dual-eligibility', 'sr-header', 'sr-shipping-options']
  const benefitsAccessElmName = 'sr-benefits'
  const dualEligibilityElmName = 'sr-dual-eligibility'
  const headerElmName = 'sr-header'
  const twoDayShippingElmName = 'sr-static-ship-options'
  const groundShippingElmName = 'sr-ground-shipping'
  const eligibilityElmName = 'sr-eligible'
  
  // attributes
  const observedElementLoggedInAttribute = 'sign-out-visible'
  
  // cart observer behavior
  const observeEntryTypes = ['resource']
  const observeInitiators = ['xmlhttprequest', 'fetch']
  const observedNameContainsPattern = ['/cart/'] // expect /cart/add, /cart/update, /cart/change, /cart/clear
  
  // custom web pixel
  const receivePostMessageEventType = 'shoprunner-custom-web-pixel-event'
    
  // maps
  const shopifyToShopRunnerPageTypeMap = {
    searchresults: 'search results',
    '/checkout/contact_information': 'checkout',
    '/checkout/shipping': 'shipping',
    '/checkout/payment': 'payment',
    '/checkout/processing': 'order processing',
    '/checkout/thank_you': 'order confirmation',
  }
  
  const observedElements = [
    {
      page: 'product',
      selectors: [benefitsAccessElmName],
      handler: syncWithLoggedInState,
      options: { attributes: true }
    },
    {
      page: 'cart',
      selectors: [benefitsAccessElmName, dualEligibilityElmName],
      handler: syncWithLoggedInState,
      options: { attributes: true }
    },
    {
      page: 'shipping',
      selectors: [themeConfig.shippingMethodsContainerSelector],
      handler: displayShopRunnerShippingComponents,
      options: { subtree: true, childList: true }
    },
    {
      page: 'payment',
      selectors: [themeConfig.payMethodContainerSelector],
      handler: displayShopRunnerShippingComponents,
      options: { subtree: true, childList: true }
    },
  ]
  
  /*
    although there is a separate ShopRunner analytics method for tracking page views (trackSBPageView), it should
    not be necessary to call it because the init function tracks a page view when it runs
    // TODO: we're tracking page views for 'checkout', 'shipping', 'payment', 'order confirmation' in a custom pixel with checkout extensibility
      verify they're not being counted twice (ShoppingBundle isn't loaded in checkout, so the init function should never run in checkout)
  */
  const webPixelEventToHandlerMap = {
    // page_viewed: trackPageViewed,
    product_viewed: trackProductViewed,
    product_added_to_cart: trackProductAddedToCart,
    checkout_completed: trackOrderPlaced,
  }
  
  // TODO: this should be replaced with a ground shipping component from the shopping bundle when it's created
  class GroundShippingComponent extends HTMLElement {
    constructor () {
      super()
    }
    connectedCallback () {
      this.style.top = "-3px"
      this.style.position = "relative"
      this.innerHTML = `
        <style>
        :host {
          display: block;
          --sr-font-family: sans-serif;
          --sr-font-weight: bold;
          --sr-link-color: #000;
        }
        .container {
          font-family: var(--sr-font-family);
          font-size: 12px;
          line-height: 18px;
        }
        .fullLogo {
          display: inline;
        }
        .srGroundShipping {
          display: inline;
        }
      </style>
      <div class="container">
        <div class="fullLogo">
          <style>
            :host {
                height: 18px;
            }
            svg {
              height: 16px; 
              width: 110px;
              overflow: visible;
            }
            .logo {
              display: inline;
            }
          </style>
          <div class="logo">
            <title>Shoprunner</title>
            <svg role="img" viewBox="0 -9 20 30" preserveAspectRatio="xMinYMin meet" aria-label="ShopRunner Logo">
            <path d="M3.29554 14.9518L10.9957 3.5849L9.67901 10.9851L17.9125 7.01831C16.9458 3.35156 13.2291 -0.0818486 8.74566 0.00148658C3.72888 0.0848218 0.245465 3.96824 0.0121266 8.15167C-0.137877 10.7517 1.11215 13.0684 3.29554 14.9518ZM14.7458 9.71837L7.04562 21.0853L8.36232 13.6851L0.128797 17.6519C1.09549 21.3186 4.81224 24.752 9.29567 24.6687C14.3125 24.5854 17.7959 20.702 18.0292 16.5185C18.1792 13.9185 16.9125 11.6017 14.7458 9.71837ZM60.8302 21.1686V13.6018H53.7133V21.1686H50.4799V3.50157H53.7133V10.7684H60.8302V3.50157H64.0302V21.1686H60.8302ZM83.0807 12.3851C83.0807 17.2519 80.464 21.4686 74.9805 21.4686C69.497 21.4686 66.847 17.2519 66.847 12.3851C66.847 7.43499 70.147 3.20156 74.9805 3.20156C79.7973 3.20156 83.0807 7.43499 83.0807 12.3851ZM70.0804 12.3351C70.0804 15.8018 71.7638 18.4519 74.9805 18.4519C78.1806 18.4519 79.8806 15.8518 79.8806 12.3518C79.8806 9.06836 78.1472 6.11829 74.9805 6.11829C71.8304 6.10162 70.0804 9.08503 70.0804 12.3351ZM92.6642 3.50157C96.2476 3.50157 98.6977 5.50161 98.6977 9.18503C98.6977 12.9518 95.9143 14.9185 92.3309 14.9185H89.0975V21.1686H85.8641V3.50157H92.6642ZM89.1142 11.9351H91.9142C94.3143 11.9351 95.4976 10.8684 95.4976 9.13503C95.4976 7.51832 94.7476 6.4683 92.3475 6.4683H89.1142V11.9351ZM193.583 3.50157C197.083 3.50157 199.433 5.40161 199.433 9.00169C199.433 12.3351 197.233 13.7518 194.917 14.2018L200 21.1686H195.967L191.2 14.2851H189.4V21.1686H186.166V3.50157H193.583ZM189.4 11.4184H192.833C195 11.4184 196.233 10.5851 196.233 8.90169C196.233 7.28499 195.35 6.45163 193.15 6.45163H189.383L189.4 11.4184ZM108.748 3.50157C112.248 3.50157 114.598 5.40161 114.598 9.00169C114.598 12.3351 112.398 13.7518 110.081 14.2018L115.165 21.1686H111.131L106.365 14.2685H104.564V21.1686H101.331V3.50157H108.748ZM104.564 11.4184H107.998C110.165 11.4184 111.398 10.5851 111.398 8.90169C111.398 7.28499 110.515 6.45163 108.315 6.45163H104.548V11.4184H104.564ZM130.898 14.6518C130.898 18.5686 128.682 21.4686 124.032 21.4686C119.382 21.4686 117.065 18.5686 117.065 14.6518V3.50157H120.298V14.4851C120.298 16.8852 121.432 18.4686 124.032 18.4686C126.632 18.4686 127.698 16.8852 127.698 14.4851V3.50157H130.898V14.6518ZM144.215 21.1686L137.582 6.48497H137.532V21.1686H134.299V3.50157H139.599L146.265 18.1686H146.315V3.50157H149.516V21.1686H144.215ZM162.816 21.1686L156.182 6.48497H156.132V21.1686H152.899V3.50157H158.199L164.866 18.1686H164.916V3.50157H168.116V21.1686H162.816ZM174.749 6.45163V10.9017H182.25V13.6685H174.749V18.1852H182.783V21.1686H171.533V3.50157H182.783V6.45163H174.749ZM42.2131 10.9184C39.7464 10.1517 38.5963 9.3517 38.5297 8.20167C38.5297 7.16831 39.4797 6.06829 41.3631 6.06829C43.0464 6.06829 44.6131 7.26832 45.6798 8.78502H45.8298L47.1465 6.03496C46.1132 4.78493 44.2131 3.20156 41.2964 3.20156C37.9463 3.20156 35.3129 5.46828 35.4463 8.21834C35.5796 11.0684 37.5963 12.5184 40.663 13.5018C43.1464 14.3018 44.5631 14.8518 44.3298 16.6019C44.0798 18.5019 39.9964 20.2186 36.8796 15.5018H36.7296L35.2796 18.5352C36.8296 20.3853 39.113 21.452 41.5131 21.4686C44.7131 21.4686 47.2965 19.4519 47.5465 16.5685C47.8465 13.5685 45.3298 11.8851 42.2131 10.9184Z" fill="#000"></path>
            </svg>
          </div>
          <div class="srGroundShipping" id="srGroundShipping">Some items are not eligible for free 2-day shipping. We will provide Free Standard Shipping for this order.</div>
        </div>
      </div>`    
    }
  }
  customElements.define("sr-ground-shipping", GroundShippingComponent)
  
  export function attachPaymentButtonListener (mutationsList, observer) {
    try {
      const { paymentButtonSelector } = themeConfig
      const paymentButton = document.querySelector(paymentButtonSelector)
      if (!paymentButton) return
      lgr.log('Attaching payment button listener')
      paymentButton.addEventListener('click', handlePaymentButton)
    } catch(e) {
      lgr.error(e)
    }
  }
  
  export function attachVariantChangeListener () {
    try {
      const { pdpVariantIdHiddenInputSelector } = themeConfig
      const variantIdHiddenInput = document.querySelector(pdpVariantIdHiddenInputSelector)
      if (!variantIdHiddenInput) return
      lgr.log('Attaching variant change listener')
      variantIdHiddenInput.addEventListener('change', trackVariantChanged)
    } catch(e) {
      lgr.error(e)
    }
  }
  
    
  /* INIT */
  window.addEventListener('load', function () {
    attachVariantChangeListener()
    attachPaymentButtonListener()
  })
  
  export async function initShopRunner (srPartnerCode, includedPageType, customThemeConfig, customAppConfig) {
    try {
      
      lgr.log('Initializing ShopRunner')
  
      // set globals
      pageType = includedPageType
      
      // set custom configuration values if provided
      if (customThemeConfig) {
        for (const [key, val] of Object.entries(customThemeConfig)) {
          if (!themeConfig.hasOwnProperty(key)) {
            lgr.error(`${key} is not a valid property on theme configuration`)
          }
          themeConfig[key] = val
        }
      }
  
      if (customAppConfig) {
        for (const [key, val] of Object.entries(customAppConfig)) {
          if (!appConfig.hasOwnProperty(key)) {
            lgr.error(`${key} is not a valid property on theme configuration`)
          }
          appConfig[key] = val
        }
      }
  
      // // get cart
      // const cart = await getCart()
      // lgr.log('cart on page load', cart) 
  
      // all pages including checkout
      initShopRunnerGlobals(srPartnerCode, pageType, appConfig.shopRunnerValidationUrl)
  
      /*
        attempt silent login to ShopRunner on all regular pages
          and in checkout if we haven't reached the payment step yet
        the function returns a boolean;
        (subsequent login state changes are handled by observer)
      */
      let isLoggedInToShopRunner = false
      // if (!['payment', 'order processing', 'order confirmation'].includes(pageType)) {
        memberAuthToken = await attemptShopRunnerSilentLogin(true)
        isLoggedInToShopRunner = memberAuthToken !== false
      // }
      
  
      // show eligible badges if user is logged in; otherwise, hide
      handleEligibleBadge(isLoggedInToShopRunner)
       
      
      // always sync cart with logged in state if not in checkout
      await updateCart(isLoggedInToShopRunner, 'initShopRunner')
  
      const updatedCart = await getCart()
      lgr.log('cart after update', updatedCart)
  
  
      // checkout pages only - for stores using checkout.liquid - TODO: will be deprecated in August 2024
      if (['checkout', 'shipping', 'payment', 'order processing', 'order confirmation'].includes(pageType)) {
        lgr.log('Handling checkout components')
        if (pageType === 'shipping') displayShopRunnerComponent('#main-header', 'after', 'sr-checkout-page')
        if (['shipping', 'payment'].includes(pageType)) displayShopRunnerShippingComponents()
  
      // all other pages
      } else {
  
        // cart requests can come from any page that can modify the cart, e.g., cart, mini cart, pdp - add to cart or payment (buy it now) button
        observeRequests(handleCartObserver, { entryTypes: observeEntryTypes })
  
        // cart
        if (pageType === 'cart') {
          await displayShopRunnerComponentsOnCartPage(null, isLoggedInToShopRunner)
        }
  
        // collection
        if (['home', 'collection', 'search results'].includes(pageType)) {
          // await displayShopRunnerComponentsOnCollectionPage(isLoggedInToShopRunner)
        }
  
        // pdp
        if (pageType === 'product') {
          await displayShopRunnerComponentsOnPdp(isLoggedInToShopRunner)
        }
  
      }
  
      // document.addEventListener('DOMContentLoaded', () => {
        const observeOnThisPage = observedElements.filter(elm => elm.page === pageType)
        // lgr.log('Registering observers on DOMContentLoaded', observeOnThisPage)
        if (observeOnThisPage.length) {
          lgr.log('Registering observers on init', observeOnThisPage)
          registerElementObservers(observeOnThisPage)
        }
      // })
      
    } catch (e) {
      lgr.error('initShopRunner error', e)
    }
  }
  
  export function initShopRunnerGlobals (srPartnerCode, pageType, shopRunnerValidationUrl) {
    try {
      // step: send a page view event to ShopRunner
      // step: initialize analytics module
      // step: initialize authentication module
      // step: attach initialized shopping variable to window
      window.shopping = init({
        partnerCode: srPartnerCode,
        pageType,
        callbacks: serverCallbacks(shopRunnerValidationUrl),
        debug: true,
        // isDev: true,
        // payload: { my: "test"}
      })
    } catch(e) {
      lgr.error(e)
    }
  }
  
  
  /* SHOPRUNNER LOGGED IN STATE MANAGEMENT -> UPDATE CART ATTRIBUTE/PROPERTIES (FOR CARRIER SERVICE TO PRESENT SHIPPING OPTIONS) */
  /*
    attempt to log in silently; if successful, return true; otherwise, return false
    NOTE: the auth.authorize function appears to update the 'sign-out-visible' property
      on all sr-* elements which contain the login form; therefore, it should not be called
      inside updateCart to avoid triggering an infinite loop
  */
  export async function attemptShopRunnerSilentLogin (getToken = false) {
    try {
      lgr.log('Attempting silent login to ShopRunner')
      const r = await window.shopping.auth.authorize({prompt: 'none'})
      // lgr.log('ShopRunner auth response:', r)
      if (!r) return false
      if (!r.shopper) return false
      if (!r.shopper.authToken) return false
      if (typeof r.shopper.authToken !== 'string') return false
      if (getToken) return r.shopper.authToken
      lgr.log('User is logged in to ShopRunner according to auth (silent login)')
      return true
    } catch(e) {
      lgr.log('ShopRunner auth (silent login) response:', e.message)
      return false
    }
  }
  
  /* 
    the shoprunner external script https://assets.prd.shoprunner.io/@shoprunner/shopping@1/es6/index.js
      handles login/auth
    if the user's shoprunner logged in state changes, the below function syncs cart attribute and line item
      property of the first cart line item with logged in state
  */
  export async function syncWithLoggedInState (mutationsList, observer) {
    try {
      if (suspendCartSync) {
        lgr.log('Cart sync is suspended')
        return
      }
      lgr.log('Suspending cart sync')
      // don't sync cart while this function is already running; this avoids infinite loop triggered when silent login updates logged in attribute
      suspendCartSync = true
      // lgr.log('mutationsList', mutationsList)
      lgr.log(`Synchronizing cart with ShopRunner logged in state`)
      const loginStateChangeMutation = mutationsList.find(m => m.attributeName === observedElementLoggedInAttribute)
      if (!loginStateChangeMutation) {
        lgr.log('Reactivating cart sync')
        suspendCartSync = false
        return
      }
      // const isLoggedInToShopRunner = loginStateChangeMutation.target.getAttribute(observedElementLoggedInAttribute) !== null
      // lgr.log(`User is logged in to ShopRunner according to observed element: ${isLoggedInToShopRunner}`, loginStateChangeMutation.target)
      /*
        it's necessary to attempt silent login after the mutation observer detects a change to the observed logged in attribute
          because we have to retrieve the auth token to send to the backend to validate this cart to support dynamic checkout buttons
      */
      memberAuthToken = await attemptShopRunnerSilentLogin(true)
      const isLoggedInToShopRunner = memberAuthToken !== false
      lgr.log(`User is${isLoggedInToShopRunner ? '' : ' not ' }logged in to ShopRunner according to silent login`)
      await handleEligibleBadge(isLoggedInToShopRunner)
      await updateCart(isLoggedInToShopRunner, 'syncWithLoggedInState')
      await displayShopRunnerComponentsOnCartPage(null, isLoggedInToShopRunner)
      lgr.log('Reactivating cart sync')
      suspendCartSync = false
    } catch(e) {
      lgr.error(e)
      lgr.log('Reactivating cart sync')
      suspendCartSync = false
    }
  }
  
  export function userIsLoggedInToShopRunner (srLoginElmNamesToCheck = []) {
    let isLoggedIn = false
    try {
      lgr.log(`Checking elements ${JSON.stringify(srLoginElmNamesToCheck)} for attribute ${observedElementLoggedInAttribute}`)
      for (const elmName of srLoginElmNamesToCheck) {
        const targetNode = document.querySelector(elmName)
        lgr.log(elmName, targetNode)
        if (!targetNode) continue
        if (targetNode.getAttribute(observedElementLoggedInAttribute) !== null ) {
          lgr.log(`Found ${observedElementLoggedInAttribute} on ${elmName}; user is logged in`)
          isLoggedIn = true
          break
        }
      }
      return isLoggedIn
    } catch(e) {
      lgr.error(e)
      return isLoggedIn
    }
  }
  
  
  /*
    track logged in state on cart attribute for stores using checkout extensibility; a delivery
      customization extension checks for cart attribute
  */
  export async function updateCartAttribute (cart, isLoggedInToShopRunner) {
    try {
      const isLoggedInStr = isLoggedInToShopRunner.toString()
      const currentLoginStateVal = cart.attributes[loggedInPrp]
      const currentToken = cart.attributes[memberAuthTokenPrp]
      const tokenStr = (memberAuthToken !== false) ? memberAuthToken : ''
      if ((currentLoginStateVal === isLoggedInStr) && (currentToken === tokenStr)) {
        lgr.log(`No change to logged in state on cart attribute ${loggedInPrp} (${currentLoginStateVal})`)
        return
      }
      const payload = {
        attributes: {
          [loggedInPrp]: isLoggedInStr,
          [memberAuthTokenPrp]: tokenStr
        }
      }
      lgr.log('Updating cart with attributes')
      let r = await fetch('/api/cart/updateAttributes', {
        method: 'POST',
        headers: cartRequestHeaders,
        body: JSON.stringify(payload)
      })
      r = await r.json()
      lgr.log('Shopify cart update response:', r)
    } catch(e) {
      lgr.error(e)
    }    
  }
  
  /*
    update all cart line items with logged in status for compatibility with stores 
    using checkout.liquid (not checkout extensibility); this functionality should be
    removed when a store migrates to checkout extensibility, on or before Shopify's
    deadline; at the time of writing, from the documentation:
      "...checkout.liquid is deprecated. It will be sunset for the Information, Shipping, 
        and Payment checkout steps on August 13, 2024..."
    (see https://shopify.dev/docs/themes/architecture/layouts/checkout-liquid)
  
    until then, stores using checkout.liquid must use the carrier service API, which
      pushes rates and cart items to a callback url via webhook when the user moves to
      checkout;
      the callback url is registered as the route /api/shipping in the backend app;
      when a rate request webhook is received, the handler for that route checks for 
      the existence of the logged in property on any cart item property; it's necessary
      to put the value a line item property because the payload received by the callback url 
      does not include cart attributes;
      the app returns ShopRunner 2 day or ground if eligible
      NOTE: the backend considers the user logged in if at least one cart item shows that
        the user is logged in, but we're updating all items in the cart in the event that the order of items
        in the cart were to change
  */
  export async function updateCartLineItemProperties (cart, isLoggedInToShopRunner) {
    try {
      let i = 0
      for await (const item of cart.items) {
        let prps = item.properties
        if (!prps) prps = { [loggedInPrp]: undefined }
        // lgr.log('item', item)
        // lgr.log(`Item ${i} key: ${item.key}`)
        // preserve existing properties, add logged in property and set it
        const isLoggedInStr = isLoggedInToShopRunner.toString()
        const currentVal = prps[loggedInPrp]
        if (currentVal === isLoggedInStr) {
          lgr.log(`No change to line item property ${loggedInPrp} (${currentVal}) on item ${i}`)
          i++
          continue
        }
        prps[loggedInPrp] = isLoggedInStr
        const payload = {
          id: item.key,
          properties: prps,
          quantity: item.quantity // required field
        }
        const lineInfo = `index ${i}, key ${item.key}`
        lgr.log(`Changing cart line item properties for item ${lineInfo}`, payload)
        let r = await fetch('/cart/change.js', {
          method: 'POST',
          headers: cartRequestHeaders,
          body: JSON.stringify(payload)
        })
        r = await r.json()
        lgr.log(`Shopify cart change response for item ${lineInfo}:`, r)
        i++
      }
    } catch(e) {
      lgr.error(e)
    }
  }
  
  export async function updateCart (isLoggedInToShopRunner, eventName = '') {
    try {
      if (eventName) lgr.log(`Cart update triggered by event ${eventName}`)
      const cart = await getCart()
      if (!cart) return
      await updateCartAttribute(cart, isLoggedInToShopRunner)
      if (!cart.items) return
      if (!cart.items.length) return    
      await updateCartLineItemProperties(cart, isLoggedInToShopRunner)
    } catch(e) {
      lgr.error(e)
    }  
  }
  
  
  /* OBSERVE AND HANDLE CHANGES TO CART */
  
  export async function handleCartRequest () {
    try {
      const cart = await getCart()
      if (JSON.stringify(theme.cart || {}) === JSON.stringify(cart)) return
      lgr.log('Cart changed')
      const isLoggedInToShopRunner = userIsLoggedInToShopRunner(srLoginElmNames)
      handleEligibleBadge(isLoggedInToShopRunner)
      const pageType = getPageType()
      if (pageType === 'cart') displayShopRunnerComponentsOnCartPage(cart)
    } catch (e) {
      lgr.error(e)
    }
  }
  
  export function handleCartObserver (list) {
    try {
      const entries = list.getEntries()
      for(const entry of entries) {
        const { name, initiatorType } = entry
        if (!(observeInitiators.includes(initiatorType))) continue
        let matched = false
        for (const pattern of observedNameContainsPattern) {
          if (name.match(pattern)) {
            matched = true
            break
          }
        }
        if (!matched) continue
        lgr.log(`Detected change; initiatorType: ${initiatorType}; name: ${name}`)
        handleCartRequest()
      }
    } catch (e) {
      lgr.error(e)
    }
  }
  
  /*
    Dynamic checkout buttons, e.g., Buy it Now, do not support cart attributes;
    https://help.shopify.com/en/manual/online-store/dynamic-checkout/compatibility#cart-attributes
    As a workaround, when a dynamic checkout button is clicked:
      - attempt silent login, requesting the shoprunner sso token as the return value
        - if a token is returned
          - fetch the cart
          - create a map with the cart line item IDs as keys and the token as the value for all IDs
          - send the map to our API at /apps/shoprunner-connect-proxy/proxy/track-cart-token
  */
  export async function handlePaymentButton (e) {
    try {
      lgr.log('Payment button (Buy it Now) click handler')
      const isLoggedInToShopRunner = userIsLoggedInToShopRunner(srLoginElmNames)
      const { shopifyStoreUrl } = themeConfig
      if (!isLoggedInToShopRunner) return
      const infoContainer = document.querySelector('product-info')
      const productUrl = `${shopifyStoreUrl}${infoContainer.dataset.url.split('?')[0]}.js`
      const r = await fetch(productUrl)
      const p = await r.json()
      lgr.log('productData', p)
      const isShopRunnerEligible = p.tags.includes(shopRunnerTag)
      lgr.log(`Is ShopRunnerEligible? ${isShopRunnerEligible}`)
      const { pdpVariantIdHiddenInputSelector } = themeConfig
      const variantIdHiddenInput = document.querySelector(pdpVariantIdHiddenInputSelector)
      if (!variantIdHiddenInput) return
      const selectedVariantId = variantIdHiddenInput.value
      /*
        can't fetch cart at this point because the cart that's fetched is not
          the cart which contains the selected item; with a dynamic checkout
          button, e.g., Buy it Now, a new cart/checkout is created with only
          the selected variant
      */
      // TODO: convert to modal with email input
      const msg = dynamicPaymentButtonModalMessage
      let email = window.prompt(msg)
      if (!email) return
      const payload = {
        variantId: selectedVariantId,
        email,
        memberAuthToken
      }
      navigator.sendBeacon(dynamicCheckoutUrl, JSON.stringify(payload))
      // const options = {
      //   method: 'GET',
      //   keepalive: true,
      //   priority: 'high'
      // }
      // let f = await fetch(`${dynamicCheckoutUrl}/1`, options)
      const options = {
        method: 'POST',
        keepalive: true,
        priority: 'high',
        body: JSON.stringify(payload)
      }
      let f = await fetch(`${dynamicCheckoutUrl}`, options)
      lgrlog('f', f)
      suspendCartSync = false
    } catch(e) {
      lgr.error(e)
      suspendCartSync = false
    }
  }
  
  
  
  
  /* OBSERVERS */
  
  export function registerElementObservers (elements) {
    lgr.log('pageType', pageType)
    for (const config of elements) {
      lgr.log('config', config)
      const { page, selectors, handler, options } = config
      lgr.log('page', page)
      if (page !== pageType) continue
      lgr.log('Registering observer', config)
      observeElements(selectors, handler, options)
    }
  }
  
  export async function observeElements (targetElmNames = [], handler, options) {
    try {
      for (const elmName of targetElmNames) {
        const targetNode = document.querySelector(elmName)
        if (!targetNode) {
          // lgr.warn(`Cannot observe element with selector ${elmName} because it does not exist`)
          continue
        }
        lgr.warn(`Observing ${elmName} with options`, options)
        const observer = new MutationObserver(handler)
        observer.observe(targetNode, options)
      }
    } catch(e) {
      lgr.error(e)
    }
  }
  
  
  export function observeRequests (handler, options) {
    const observer = new PerformanceObserver(handler)
    observer.observe(options)
  }
  
  
  
  /* ANALYTICS - For use with ShopRunner Custom Pixel https://admin.shopify.com/store/testing-blueacorn-stg/settings/customer_events/pixels/ */
  
  // get the element corresponding with the frame of an event source where the source is 
  function getElementOfEventSource (e, containerId) {
    let foundElement
    try {
      const container = document.getElementById(containerId)
      const sandboxPixelElements = container.getElementsByTagName('iframe')
      for (let c = 0; c < sandboxPixelElements.length; c++) {
        const element = sandboxPixelElements[c]
        const frame = element.contentWindow
        if (frame === e.source) {
          foundElement = element
          break
        }
      }
    } catch(e) {
      lgr.error(e.message)
    }
    return foundElement 
  }
  
  // listen for and handle custom web pixel events
  window.addEventListener('message', function(e) {
    if (e.isTrusted !== true) return // event was generated by a user action; not created/modified by a script or EventTarget.dispatchEvent()
    if (e.origin !== 'null') return // origin is null (expected because the event is from a web pixel in a sandboxed iframe)
    if (!e.data) return // contains data
    if (e.data.type !== receivePostMessageEventType) return // event data type is defined as 'shoprunner-custom-web-pixel-event'
    const eventSourceElement = getElementOfEventSource(e, 'WebPixelsManagerSandboxContainer')
    if (eventSourceElement === undefined) return // event source element was found in this window in the expected web pixel container
    const eventOrigin = eventSourceElement.src
    const currentOrigin = window.location.origin
    if (eventOrigin.indexOf(currentOrigin) !== 0) return // event (iframe) src is from same origin as current window, confirmed!
    lgr.log(`Received message from ${e.data.type}:`, e)
    const payload = JSON.stringify({ data: e.data })
    webPixelEventToHandlerMap[e.data.event.name](e.data)
    // optionally, send a POST request using sendBeacon method; see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon
    // const queued = navigator.sendBeacon(<url>, payload)
    // lgr.log('Message queued:', queued)
  })
  
  export async function trackVariantChanged (e) {
    try {
      // TODO: this will only work on PDP; enhance to work on other pages where variant selection is supported
      const variantId = e.target.value
      const { shopifyStoreUrl } = themeConfig
      lgr.log(`Variant has changed to: ${variantId}`)
      const productUrl = `${shopifyStoreUrl}${window.location.href.split('?')[0]}.js`
      const r = await fetch(productUrl)
      const p = await r.json()
      lgr.log('productData', p)
      const v = p.variants.find(v => v.id == variantId)
      lgr.log('productVariant', v)
      const { sku, price } = v
      const amount = price
      const payload = {
        sku,
        regularPrice: v.compare_at_price ? v.compare_at_price * 100 : amount * 100,
        salePrice: amount * 100,
        availability: v.available  ? 'in' : 'out'
      }
      lgr.log('tracking product viewed on variant change', payload)
      window.shopping.analytics.trackProductViewed(payload)
    } catch(e) {
      lgr.error(e)
    }
  }
  
  export async function trackProductViewed (customPixelData) {
    try {
      lgr.log('customPixelData', customPixelData)
      const { shopifyStoreUrl } = themeConfig
      const productVariant = customPixelData.event.data.productVariant
      lgr.log('productVariant', productVariant)
      lgr.log('shopifyStoreUrl', shopifyStoreUrl)
      const { sku, product, price } = productVariant
      const { url } = product
      const { amount } = price
      const productUrl = `${shopifyStoreUrl}${url.split('?')[0]}.js`
      const r = await fetch(productUrl)
      const p = await r.json()
      lgr.log('productData', p)
      lgr.log('productVariant.id', productVariant.id)
      const v = p.variants.find(v => v.id == productVariant.id)
      const payload = {
        sku,
        regularPrice: v.compare_at_price ? v.compare_at_price * 100 : amount * 100,
        salePrice: amount * 100,
        availability: v.available  ? 'in' : 'out'
      }
      lgr.log('tracking product viewed', payload)
      window.shopping.analytics.trackProductViewed(payload)
    } catch(e) {
      lgr.error(e)
    }
  }
  
  export async function trackProductAddedToCart (customPixelData) {
    try {
      lgr.log('customPixelData', customPixelData)
      const cartLineAdded = customPixelData.event.data.cartLine
      lgr.log('cartLineAdded', cartLineAdded)
      const { cost, merchandise, quantity } = cartLineAdded
      const { product, sku } = merchandise
      const { shopifyStoreUrl } = themeConfig
      let { url } = product
      if (!url) {
        const matchingCartLine = customPixelData.init.data.cart.lines.find(l => l.merchandise.product.id === product.id)
        const { url } = matchingCartLine.merchandise.product
      }
      const productUrl = `${shopifyStoreUrl}${url.split('?')[0]}.js`
      const r = await fetch(productUrl)
      const p = await r.json()
      lgr.log('product in trackProductAddedToCart', p)
      // TODO: set sku to default if only default or first available if none selected?
      const isShopRunnerEligible = p.tags.includes(shopRunnerTag)
      const payload = {
        sku,
        quantity,
        shopRunnerEligible: isShopRunnerEligible,
      }
      lgr.log('tracking add to cart', payload)
      window.shopping.analytics.trackAddToCart(payload)
    } catch(e) {
      lgr.error(e)
    }
  }
  
  export async function trackOrderPlaced (customPixelData) {
    try {
      lgr.log('customPixelData', customPixelData)
      const checkout = customPixelData.event.data.checkout
      lgr.log('checkout', checkout)
      const { order, lineItems, shippingLine, totalPrice, subtotalPrice, totalTax } = checkout
      const { id } = order
      const orderItems = lineItems.map(line => {
        const { quantity, variant } = line
        const { sku } = variant
        // TODO: add shopRunnerEligible and shippingType?
        return { sku, quantity }
      })
      const payload = {
        orderId: id,
        orderItems,
        subtotal: subtotalPrice.amount * 100,
        tax: totalTax.amount * 100,
        shippingPrice: shippingLine.price.amount * 100,
        orderTotal: totalPrice.amount * 100,
        paymentType: '' // TODO: add paymentType
      }
      lgr.log('tracking order placed', payload)
      window.shopping.analytics.trackOrder(payload)
    } catch(e) {
      lgr.error(e)
    }
  }
  
  
  
  /* DOM: ShopRunner Component Placement and Updates */
  
  // expect method to be one of the following: append, prepend, before, after, replaceWith
  export function displayShopRunnerComponent (target, method, componentSelector) {
    // lgr.log(`Checking ShopRunner component(s)...`, arguments)
    try {
      target = (typeof target === 'string') ? document.querySelector(target) : target
      if (!target) {
        throw new Error(`Target ${target} does not exist`)
      }
      /*
        TODO: this assumes the element should not be both a child of the target and the target's parent;
          it should cover all typical supported cases for this app where the node is inserted as a child
          or sibling of target; test and provide a subset methods to control this behavior
      */
      const found = target.querySelector(componentSelector) || target.parentElement.querySelector(componentSelector)
      // const found = target.querySelector(componentSelector)
      if (found) {
        lgr.log(`Component ${componentSelector} already exists at the location specified`)
        found.classList.add(showElementClass)
        return
      }
      lgr.log(`Displaying ${componentSelector}; args:`, arguments)
      const componentToDisplay = document.createElement(componentSelector)
      lgr.log(`Adding ${showElementClass} class`)
      componentToDisplay.classList.add(showElementClass)
      target[method](componentToDisplay)
      // re-register element observers on this page 
      const pageType = getPageType()
      const observeOnThisPage = observedElements.filter(elm => (elm.page === pageType) && (elm.selectors.includes(componentSelector)))
      if (observeOnThisPage.length) {
        lgr.log('Registering observers on component placement', observeOnThisPage)
        registerElementObservers(observeOnThisPage)
      }
    } catch (e) {
      lgr.error(e)
    }
  }
  
  export async function displayShopRunnerComponentsOnPdp (isLoggedInToShopRunner) {
    lgr.log('Updating display of custom ShopRunner elements on PDP')
    try {
      const { pdpBenefitsAccessSelector, pdpVariantIdHiddenInputSelector } = themeConfig
      displayShopRunnerComponent(pdpBenefitsAccessSelector, 'before', benefitsAccessElmName)
    } catch (e) {
      lgr.error(e)
    }
  }
  
  export async function displayShopRunnerComponentsOnCollectionPage (isLoggedInToShopRunner) {
    lgr.log('Displaying ShopRunner components on collection page')
    try {
    } catch (e) {
      lgr.error(e)
    }
  }
  
  // if mixed cart and user is logged in, display dual eligibility; else, display benefits access
  export async function displayShopRunnerComponentsOnCartPage (cart, isLoggedInToShopRunner) {
    lgr.log('Updating display of custom ShopRunner elements on cart page')
    try {
      if (!cart) cart = await getCart()
      if (isLoggedInToShopRunner === undefined) {
        isLoggedInToShopRunner = userIsLoggedInToShopRunner(srLoginElmNames)
      }
      // display benefits access or dual eligibility component
      const { cartPageBenefitsAccessSelector } = themeConfig
      const shippingType = await getShopRunnerShippingEligibilityType(cart)
      const isDualEligible = isLoggedInToShopRunner && (shippingType === 'ground')
      const componentName = isDualEligible ? dualEligibilityElmName : benefitsAccessElmName
      const componentToReplaceName = isDualEligible ? benefitsAccessElmName : dualEligibilityElmName
      const exists = document.querySelector(componentToReplaceName)
      if (exists) {
        displayShopRunnerComponent(componentToReplaceName, 'replaceWith', componentName)
        return
      }
      displayShopRunnerComponent(cartPageBenefitsAccessSelector, 'append', componentName)
    } catch (e) {
      lgr.error(e)
    }
  }

  export function replaceLocalhost(url) {
    if (!url) return
    const localhost = 'http://localhost:3000'
    const { shopifyStoreUrl } = themeConfig
    if (url.includes(localhost)) {
        return url.replace(localhost, shopifyStoreUrl);
    }
    return url;
  }
  
  export async function handleEligibleBadge (isLoggedInToShopRunner, cart) {
    const { eligibilityContainerSelectors, shopifyStoreUrl} = themeConfig
    lgr.log('Handling eligible badge')
    lgr.log('shopifyStoreUrl', shopifyStoreUrl)
    // if the user is not logged in, remove the badge if it exists
    if (!isLoggedInToShopRunner) {
      const eligibleBadges = document.querySelectorAll(eligibilityElmName)
      for (const badge of eligibleBadges) badge.classList.remove(showElementClass)
      return
    }
    for (const settings of eligibilityContainerSelectors) {
      let {
        productSelector,
        locationMethod,
        locationSelector,
        locationSelectorChild,
        placementMethod,
        pageTypes,
        pageTypesExcluded
      } = settings
      if (Array.isArray(pageTypes) && pageTypes.length && !pageTypes.includes(pageType)) {
        continue
      }
      if (Array.isArray(pageTypesExcluded) && pageTypesExcluded.length && pageTypesExcluded.includes(pageType)) {
        continue
      }
      placementMethod = placementMethod || 'append'
      lgr.log('productSelector', productSelector)
      const productElements = document.querySelectorAll(productSelector)
      for (const productElement of productElements) {
        lgr.log('productElement', productElement)
        lgr.log('productElementHref', productElement.href)
        let href = (!productElement.href)? productElement.href:`${replaceLocalhost(productElement.href)}`
        if (!href) {
          if (productElement.dataset.productId) {
            if (!cart) cart = await getCart()
            console.log('cart', cart)
            if (cart) {
              const foundCartItem = cart.items.find(i => i.product_id == productElement.dataset.productId)
              if (foundCartItem) href = `${shopifyStoreUrl}/products/${foundCartItem.handle}`
            }
          }
        }
        if (!href) href = (shopifyStoreUrl)? `${shopifyStoreUrl}${window.location.pathname}`: window.location.href
        if (!href.includes('/products')) {
          console.error('Could not get product URL')
          continue
        }
        lgr.log('href!!!!', href, window.location.href, shopifyStoreUrl)
        const productUrl = `${href.split('?')[0]}.js`
        const r = await fetch(productUrl)
        const p = await r.json()
        lgr.log('p.tags', p.tags)
        const isTaggedShopRunner = p.tags.includes(shopRunnerTag)
        // TODO: exclude digital products, e.g., gift cards?
        if (!isTaggedShopRunner) {
          const badgesToHide = productElement.parentNode.querySelectorAll(eligibilityElmName)
          lgr.log(`Hiding badges on products without ${shopRunnerTag} tag`, badgesToHide)
          for (const badgeToHide of badgesToHide) badgeToHide.classList.remove(showElementClass)
          continue
        }
        let placementTarget = productElement[locationMethod](locationSelector)
        if (!placementTarget) {
          lgr.warn(`Could not find element using method ${locationMethod} with selector ${locationSelector} in relation to elements ${productSelector}`)
          continue
        }
        lgr.log('Found placement target', placementTarget)
        if (locationSelectorChild) {
          placementTarget = placementTarget.querySelector(locationSelectorChild)
          if (!placementTarget) {
            lgr.warn(`Could not find element using querySelector method with selector ${locationSelectorChild} in relation to element ${locationSelector}`)
            continue
          }
          lgr.log('Found placement target child', placementTarget)
        }
        lgr.log('Displaying eligibility badge for shoprunner tagged item', 'productElement:', productElement, 'productUrl:', productUrl, 'placementTarget:', placementTarget)
        displayShopRunnerComponent(placementTarget, placementMethod, eligibilityElmName)
      }
    }
  }
  
  // checkout.liquid: replace placeholder text with ShopRunner components shipping methods if they exist; TODO: remove after August 2024
  export function displayShopRunnerShippingComponents () {
    lgr.log('Displaying ShopRunner shipping components')
    try {
      const { shippingSelector, payMethodSelector } = themeConfig 
      const method = 'replaceChildren'
      // TODO: handle pay method selector outside loop, because it's being checked twice
      const targetSelectors = [shippingSelector, payMethodSelector]
      for (const serviceName of [twoDayShippingServiceName, groundShippingServiceName]) {
        for (let targetSelector of targetSelectors) {
          if (targetSelector.includes('<serviceName>')) targetSelector = targetSelector.replace('<serviceName>', serviceName)
          lgr.log(`Checking if ${targetSelector} exists`)
          const targetElm = document.querySelector(targetSelector)
          if (!targetElm) continue
          lgr.log(`${targetSelector} exists`)
          if (!targetElm.textContent.includes(serviceName)) continue
          lgr.log(`${targetSelector} includes the text ${serviceName}`)
          const componentName = (serviceName === groundShippingServiceName) ? groundShippingElmName : twoDayShippingElmName
          displayShopRunnerComponent(targetSelector, method, componentName)
        }
      }
    } catch(e) {
      lgr.error(e)
    }
  }
  
  
  /* HELPERS */
  
  export async function getCart () {
    try {
     // const cartResponse = await fetch('/cart.json')
      const cartResponse = await fetch('/api/cart')
      const cart = await cartResponse.json()
      return cart
    } catch (e) {
      lgr.error(e)
    }
  }
  
  export function getPageType (pageTypeFromLiquid = '') {
    let pageType = ''
    try {
      let shopifyPageData = window.ShopifyAnalytics.meta.page
      // event.context.document.location.pathname.split('/').pop()
      // Shopify.Checkout.step
      let prp = 'pageType'
      if (pageTypeFromLiquid === 'checkout') prp = 'path'
      if (shopifyPageData) pageType = shopifyPageData[prp]
      const mappedVal = shopifyToShopRunnerPageTypeMap[pageType]
      pageType = mappedVal || pageType || pageTypeFromLiquid
      return pageType
    } catch (e) {
      lgr.error(e)
      return pageType
    }
  }
  
  export async function getShopRunnerShippingEligibilityType (cart) {
    lgr.log('Checking if cart is eligible for ShopRunner shipping')
    const { shopifyStoreUrl } = themeConfig
    let type = 'ineligible'
    if (!cart) cart = await getCart()
  
    let taggedCount = 0
    lgr.log('cart items', cart.items)
    for await (const item of cart.items) {
      const productUrl = `${shopifyStoreUrl}${item.url.split('?')[0]}.js`
      const r = await fetch(productUrl)
      const p = await r.json()
      lgr.log('p.tags', p.tags)
      if (p.tags.includes(shopRunnerTag)) {
        taggedCount++
      }
    }
    if (taggedCount === 0) {
      type = 'ineligible'
    } else if (taggedCount === cart.items.length) {
      type = '2-day'
    } else {
      type = 'ground'
    }
  
    lgr.log(`Cart ShopRunner shipping eligibility: ${type}`)
    return type
  }
  
  export const lgr = {
    log: function () { if (appConfig.logLevel > 2) console.log(...arguments) },
    warn: function () { if (appConfig.logLevel > 1) console.warn(...arguments) },
    error: function () { if (appConfig.logLevel > 0) console.error(...arguments) },
  }