import { Module } from '@nestjs/common';
import { RoutesService } from './routes.service';
import { RoutesController } from './routes.controller';
import { RouteResolverScheduler } from './route-resolver.scheduler';

@Module({
  controllers: [RoutesController],
  providers: [RoutesService, RouteResolverScheduler],
  exports: [RoutesService],
})
export class RoutesModule {}
