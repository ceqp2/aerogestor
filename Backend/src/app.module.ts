import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthGuard } from './common/auth.guard';
import { CommonModule } from './common/common.module';
import { Publico } from './common/contexto';
import { DatabaseModule, PrismaService } from './database/prisma.service';
import { JobsModule } from './jobs/jobs.module';
import { IntegracoesModule } from './integrations/integracoes.module';
import { AtasModule } from './modules/atas/atas.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { AuthModule } from './modules/auth/auth.module';
import { CalendarioModule } from './modules/calendario/calendario.module';
import { ContratosModule } from './modules/contratos/contratos.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DocumentosModule } from './modules/documentos/documentos.module';
import { ExecucaoModule } from './modules/execucao/execucao.module';
import { FinanceiroModule } from './modules/financeiro/financeiro.module';
import { NotificacoesModule } from './modules/notificacoes/notificacoes.module';
import { PlanejamentoModule } from './modules/planejamento/planejamento.module';
import { ProcessosModule } from './modules/processos/processos.module';
import { RelatoriosModule } from './modules/relatorios/relatorios.module';
import { RiscosModule } from './modules/riscos/riscos.module';
import { SolicitacoesModule } from './modules/solicitacoes/solicitacoes.module';
import { UnidadesModule } from './modules/unidades/unidades.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';

@Controller()
class HealthController {
  constructor(private prisma: PrismaService) {}

  @Publico()
  @Get('health')
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', banco: 'ok', horario: new Date().toISOString() };
  }
}

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60000, limit: 300 }],
      // desativável apenas em testes automatizados fora de produção
      skipIf: () => process.env.NODE_ENV !== 'production' && process.env.THROTTLE_DISABLED === 'true',
    }),
    DatabaseModule,
    CommonModule,
    AuthModule,
    UsuariosModule,
    UnidadesModule,
    AuditoriaModule,
    PlanejamentoModule,
    ProcessosModule,
    AtasModule,
    ContratosModule,
    ExecucaoModule,
    FinanceiroModule,
    RiscosModule,
    CalendarioModule,
    NotificacoesModule,
    SolicitacoesModule,
    DocumentosModule,
    IntegracoesModule,
    DashboardModule,
    RelatoriosModule,
    JobsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
