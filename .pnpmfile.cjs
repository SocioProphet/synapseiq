module.exports = {
  hooks: {
    readPackage(pkg) {
      if (pkg.name === '@socioprophet/synapseiq-enrichment') {
        pkg.dependencies = pkg.dependencies || {};
        pkg.dependencies['@socioprophet/synapseiq-utils'] = 'workspace:*';
      }

      return pkg;
    },
  },
};
