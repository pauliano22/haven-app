// Reads app.json and adds one optional override: EXPO_PUBLIC_BASE_URL sets
// experiments.baseUrl, so the web demo export can be served from a sub-path
// (e.g. /haven-website/demo on GitHub Pages). Unset = unchanged behavior.
module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_PUBLIC_BASE_URL;
  if (!baseUrl) return config;
  return { ...config, experiments: { ...(config.experiments || {}), baseUrl } };
};
