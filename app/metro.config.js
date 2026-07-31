const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// @supabase/supabase-js optionally imports @opentelemetry/api for tracing and
// swallows the failure at runtime, but Metro resolves imports at build time and
// hard-errors on the missing package. Resolve it to an empty module instead.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@opentelemetry/api") {
    return { type: "empty" };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
