## Plan

1. **Make GA loading deterministic**
   - Replace the current “fire config immediately after appending the script” flow with a safer loader that waits for `gtag.js` to load before sending GA events.
   - Keep the existing measurement ID: `G-68MGP78M5X`.

2. **Send page views explicitly**
   - Change the initial GA config to `send_page_view: false` so Google does not rely on an automatic pageview that may be racing consent/script load.
   - Keep `RouteAnalytics` responsible for sending explicit `page_view` events for the first page load and route changes.

3. **Fix consent timing**
   - Set Consent Mode defaults before loading GA.
   - Since cookies/analytics are meant to be automatic unless users opt out, send `analytics_storage: granted` before the first pageview unless local storage says the user opted out.

4. **Avoid duplicate or lost events**
   - Add a tiny internal event queue/ready promise so pageviews fired before the script is fully ready are sent once GA is available.
   - Ensure opt-out still prevents future events.

5. **Validation instructions after publish**
   - After implementation, publish the app, then test with Tag Assistant again.
   - Expected result: Tag Assistant should show at least one sent `page_view` hit instead of “Deferred hits / No hits were sent,” and GA Realtime/DebugView should start showing activity.