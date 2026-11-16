const app = require("./app.json");

module.exports = () => {
  const expo = {
    ...app.expo,
    web: { ...app.expo.web },
    experiments: { ...app.expo.experiments },
  };
  if (process.env.EXPO_WEB_OUTPUT) expo.web.output = process.env.EXPO_WEB_OUTPUT;
  if (process.env.EXPO_BASE_URL) expo.experiments.baseUrl = process.env.EXPO_BASE_URL;
  return { expo };
};
