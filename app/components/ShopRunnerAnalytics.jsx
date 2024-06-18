import {useAnalytics} from '@shopify/hydrogen';
import {useEffect} from 'react';

export function ShopRunnerAnalytics() {
  const {subscribe} = useAnalytics();
  // Register this analytics integration - this will prevent any analytics events
  // from being sent until this integration is ready
  const {ready} = register('Third Party Analytics Integration');

  useEffect(() => {
    // Standard events
    subscribe('page_viewed', (data) => {
      console.log('ShopRunnerAnalytics - Page viewed:', data);
    });
    subscribe('product_viewed', (data) => {
      console.log('ShopRunnerAnalytics - Product viewed:', data);
    });
    subscribe('collection_viewed', (data) => {
      console.log('ShopRunnerAnalytics - Collection viewed:', data);
    });
    subscribe('cart_viewed', (data) => {
      console.log('ShopRunnerAnalytics - Cart viewed:', data);
    });
    subscribe('cart_updated', (data) => {
      console.log('ShopRunnerAnalytics - Cart updated:', data);
    });

    // Custom events
    subscribe('custom_checkbox_toggled', (data) => {
      console.log('ShopRunnerAnalytics - Custom checkbox toggled:', data);
    });

    // Mark this analytics integration as ready as soon as it's done setting up
    ready();
  }, []);

  return null;
}
