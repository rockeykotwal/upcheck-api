/** String tokens for non-class dependencies registered in the DI container. */
export const TOKENS = {
  DrizzleDb:           'DrizzleDb',
  RedisClient:         'RedisClient',
  MongoDb:             'MongoDb',
  EmailProvider:       'EmailProvider',
  EmailService:        'EmailService',
  CompanyRepository:    'CompanyRepository',
  StatusFetcherService: 'StatusFetcherService',
  SnapshotRepository:    'SnapshotRepository',
  StatusPollerService:   'StatusPollerService',
} as const;
