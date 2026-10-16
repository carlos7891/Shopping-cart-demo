import { Module } from '@nestjs/common';
import { EcommerceApplicationService } from '../application/ecommerce-application.service';
import {
  ORDER_REPOSITORY_PORT,
  PRODUCT_REPOSITORY_PORT,
  RULE_CONFIG_REPOSITORY_PORT
} from '../application/ports/repositories.ports';
import { EcommerceController } from './http/ecommerce.controller';
import { SqlitePersistenceAdapter } from './persistence/sqlite-persistence.adapter';

@Module({
  controllers: [EcommerceController],
  providers: [
    {
      provide: SqlitePersistenceAdapter,
      useFactory: () => new SqlitePersistenceAdapter()
    },
    {
      provide: PRODUCT_REPOSITORY_PORT,
      useExisting: SqlitePersistenceAdapter
    },
    {
      provide: ORDER_REPOSITORY_PORT,
      useExisting: SqlitePersistenceAdapter
    },
    {
      provide: RULE_CONFIG_REPOSITORY_PORT,
      useExisting: SqlitePersistenceAdapter
    },
    EcommerceApplicationService
  ],
  exports: [EcommerceApplicationService, SqlitePersistenceAdapter]
})
export class AppModule {}
