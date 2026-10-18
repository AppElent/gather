// Sentry's wrapper around Expo's default config: it stamps every bundle with a
// debug ID, which is how an uploaded source map finds the stack it belongs to —
// for the embedded bundle and for each over-the-air update alike.
const { getSentryExpoConfig } = require('@sentry/react-native/metro')

module.exports = getSentryExpoConfig(__dirname)
