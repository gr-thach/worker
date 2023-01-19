const {
  getRuleOverridesForFinding,
  defaultProcessor
} = require('../../../../src/content/processing/default/processor');

const npmAuditMapping = {
  JSNPM0001: {
    grId: 'GR0013',
    title: 'Vulnerable Libraries',
    docFile: 'using_vulnerable_libraries.html'
  }
};

const engineOutputMock = require('../../../mocks/engineOutput.json');

describe('default processor', () => {
  describe('getRuleOverridesForFinding', () => {
    it('should return default values', () => {
      const ruleOverrideValues = getRuleOverridesForFinding(
        {},
        'javascript',
        'npm-audit',
        'GR0013',
        'JSNPM0001'
      );
      expect(ruleOverrideValues).toEqual({
        engineRuleEnabled: true,
        grRuleEnabled: true,
        grRuleEnabledForLanguage: true
      });
    });

    it('should return values from config', () => {
      const ruleOverrideValues = getRuleOverridesForFinding(
        {
          ruleOverride: {
            engineRules: {
              'javascript-npm-audit': {
                JSNPM0001: {
                  enable: false
                }
              }
            },
            GuardRailsRules: {
              GR0013: {
                enable: false,
                languages: {
                  javascript: false
                }
              }
            }
          }
        },
        'javascript',
        'npm-audit',
        'GR0013',
        'JSNPM0001'
      );
      expect(ruleOverrideValues).toEqual({
        engineRuleEnabled: false,
        grRuleEnabled: false,
        grRuleEnabledForLanguage: false
      });
    });

    describe('defaultProcessor', () => {
      xit('should return vulnerabilitiesByGrId', () => {
        const vulnerabilitiesByGrId = defaultProcessor(
          engineOutputMock,
          'npm-audit',
          { 'npm-audit': npmAuditMapping },
          {}
        );
        expect(Object.values(vulnerabilitiesByGrId.vulnerabilitiesByGrId).flat(2).length).toEqual(
          11
        );
      });

      it('should respect disabled engineRule', () => {
        const vulnerabilitiesByGrId = defaultProcessor(
          engineOutputMock,
          'npm-audit',
          { 'npm-audit': npmAuditMapping },
          {
            ruleOverride: {
              engineRules: {
                'javascript-npm-audit': {
                  JSNPM0001: {
                    enable: false
                  }
                }
              }
            }
          }
        );
        expect(Object.values(vulnerabilitiesByGrId.vulnerabilitiesByGrId).flat(2).length).toEqual(
          0
        );
      });

      it('should respect disabled grRule', () => {
        const vulnerabilitiesByGrId = defaultProcessor(
          engineOutputMock,
          'npm-audit',
          { 'npm-audit': npmAuditMapping },
          {
            ruleOverride: {
              GuardRailsRules: {
                GR0013: {
                  enable: false,
                  languages: {
                    javascript: false
                  }
                }
              }
            }
          }
        );
        expect(Object.values(vulnerabilitiesByGrId.vulnerabilitiesByGrId).flat(2).length).toEqual(
          0
        );
      });

      it('should respect disabled language in grRule', () => {
        const vulnerabilitiesByGrId = defaultProcessor(
          engineOutputMock,
          'npm-audit',
          { 'npm-audit': npmAuditMapping },
          {
            ruleOverride: {
              GuardRailsRules: {
                GR0013: {
                  enable: true,
                  languages: {
                    javascript: false
                  }
                }
              }
            }
          }
        );
        expect(Object.values(vulnerabilitiesByGrId.vulnerabilitiesByGrId).flat(2).length).toEqual(
          0
        );
      });

      it('should respect disabled grRule even when language is enabled', () => {
        const vulnerabilitiesByGrId = defaultProcessor(
          engineOutputMock,
          'npm-audit',
          { 'npm-audit': npmAuditMapping },
          {
            ruleOverride: {
              GuardRailsRules: {
                GR0013: {
                  enable: false,
                  languages: {
                    javascript: true
                  }
                }
              }
            }
          }
        );
        expect(Object.values(vulnerabilitiesByGrId.vulnerabilitiesByGrId).flat(2).length).toEqual(
          0
        );
      });
    });
  });
});
