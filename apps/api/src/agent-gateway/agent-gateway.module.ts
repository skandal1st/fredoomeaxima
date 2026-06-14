import { Global, Module } from '@nestjs/common';
import { AgentGatewayService } from './agent-gateway.service';

@Global()
@Module({
  providers: [AgentGatewayService],
  exports: [AgentGatewayService],
})
export class AgentGatewayModule {}
