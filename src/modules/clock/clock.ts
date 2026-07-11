import { SigssAdapter } from '../../utils/sigssAdapter';

/**
 * MÓDULO 1 - Relógio
 * 
 * Corrige o relógio do cabeçalho do SIGSS mostrando o horário atual
 * do computador do usuário, atualizado em tempo real segundo a segundo.
 */
export class ClockModule {
  private intervalId: number | null = null;

  public start() {
    this.stop();
    this.tick();
    
    this.intervalId = window.setInterval(() => {
      this.tick();
    }, 1000);
  }

  public stop() {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private tick() {
    const clockEl = SigssAdapter.getClockElement();
    if (!clockEl) {
      return;
    }

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    
    // Atualiza o conteúdo do elemento
    clockEl.textContent = `${hh}:${mm}:${ss}`;
  }
}
