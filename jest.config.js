module.exports = {
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/packages/core/dist/"],
  testEnvironment: "node",
  transform: {
    "^.+\\.jsx?$": "babel-jest"
  }
};
