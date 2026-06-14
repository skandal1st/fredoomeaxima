import { Module } from '@nestjs/common';
import { PeersService } from './peers.service';
import { PeersController } from './peers.controller';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { RoutesModule } from '../routes/routes.module';

@Module({
  imports: [SubscriptionsModule, RoutesModule],
  controllers: [PeersController],
  providers: [PeersService],
  exports: [PeersService],
})
export class PeersModule {}
