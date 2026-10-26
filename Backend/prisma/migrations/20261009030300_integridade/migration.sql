-- Auditoria append-only pela aplicação: bloqueia UPDATE/DELETE/TRUNCATE.
-- Observação: um superusuário do banco ainda pode desabilitar triggers; por isso
-- recomenda-se cópia externa protegida dos logs (ver docs/seguranca.md).
CREATE OR REPLACE FUNCTION auditoria_somente_insercao() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'RegistroAuditoria é append-only (operação % bloqueada)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auditoria_no_update BEFORE UPDATE OR DELETE ON "RegistroAuditoria"
  FOR EACH ROW EXECUTE FUNCTION auditoria_somente_insercao();
CREATE TRIGGER trg_auditoria_no_truncate BEFORE TRUNCATE ON "RegistroAuditoria"
  FOR EACH STATEMENT EXECUTE FUNCTION auditoria_somente_insercao();

-- Ledgers financeiros também são somente inserção (correção por estorno).
CREATE OR REPLACE FUNCTION ledger_somente_insercao() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Movimentos financeiros não podem ser alterados ou apagados; utilize estorno (%).', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mov_empenho_imutavel BEFORE UPDATE OR DELETE ON "MovimentoEmpenho"
  FOR EACH ROW EXECUTE FUNCTION ledger_somente_insercao();
CREATE TRIGGER trg_mov_credito_imutavel BEFORE UPDATE OR DELETE ON "MovimentoCredito"
  FOR EACH ROW EXECUTE FUNCTION ledger_somente_insercao();
CREATE TRIGGER trg_mov_rap_imutavel BEFORE UPDATE OR DELETE ON "MovimentoRestosAPagar"
  FOR EACH ROW EXECUTE FUNCTION ledger_somente_insercao();
CREATE TRIGGER trg_mov_ata_imutavel BEFORE UPDATE OR DELETE ON "MovimentoQuantidadeAta"
  FOR EACH ROW EXECUTE FUNCTION ledger_somente_insercao();

-- Valores positivos e escalas válidas.
ALTER TABLE "MovimentoEmpenho" ADD CONSTRAINT mov_empenho_valor_pos CHECK (valor > 0);
ALTER TABLE "MovimentoCredito" ADD CONSTRAINT mov_credito_valor_pos CHECK (valor > 0);
ALTER TABLE "MovimentoRestosAPagar" ADD CONSTRAINT mov_rap_valor_pos CHECK (valor > 0);
ALTER TABLE "MovimentoQuantidadeAta" ADD CONSTRAINT mov_ata_qtd_pos CHECK (quantidade > 0);
ALTER TABLE "RateioEmpenho" ADD CONSTRAINT rateio_valor_pos CHECK (valor > 0);
ALTER TABLE "Risco" ADD CONSTRAINT risco_escala CHECK (probabilidade BETWEEN 1 AND 5 AND impacto BETWEEN 1 AND 5
  AND (("probResidual" IS NULL) OR "probResidual" BETWEEN 1 AND 5)
  AND (("impactoResidual" IS NULL) OR "impactoResidual" BETWEEN 1 AND 5));
ALTER TABLE "ContratoInstrumento" ADD CONSTRAINT contrato_vigencia CHECK ("vigenciaFim" >= "vigenciaInicio");
ALTER TABLE "Ata" ADD CONSTRAINT ata_vigencia CHECK ("vigenciaFim" >= "vigenciaInicio");
