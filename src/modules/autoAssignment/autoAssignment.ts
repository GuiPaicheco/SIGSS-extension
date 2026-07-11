import { SigssAdapter, SIGSS_SELECTORS } from '../../utils/sigssAdapter';
import { ConfigManager, EsfMapping } from '../../core/config';

/**
 * MÓDULO 4 - Automação de Lançamentos
 * 
 * Identifica a equipe ESF do paciente na página de lançamentos e preenche
 * automaticamente o Profissional, Equipe e CBO correspondente de acordo com 
 * a configuração capturada anteriormente.
 * Inclui o "Modo Aprendizado" que captura as seleções efetuadas pelo usuário.
 */
export class AutoAssignmentModule {
  private equipeObserver: MutationObserver | null = null;
  private lastProcessedPatientId = '';
  private isProcessingAutofill = false;


  public async start() {
    this.injectCaptureButton();

    // Iniciar monitoramento da tabela de equipe para reagir dinamicamente quando ela for atualizada por Ajax
    this.setupEquipeObserver();
  }

  public stop() {
    const btn = document.getElementById('sigss-plus-capture-btn');
    if (btn) {
      btn.remove();
    }

    if (this.equipeObserver) {
      this.equipeObserver.disconnect();
      this.equipeObserver = null;
    }
  }

  /**
   * Monitora alterações na lista de opções da Equipe.
   * Quando o SIGSS atualiza as equipes (via AJAX após a seleção do paciente), reagimos imediatamente.
   */
  private setupEquipeObserver() {
    const equipeSelect = document.querySelector(SIGSS_SELECTORS.equipeSelect) as HTMLSelectElement | null;
    if (!equipeSelect) return;

    this.equipeObserver = new MutationObserver(async () => {
      await this.checkAndTriggerAutofill();
    });

    this.equipeObserver.observe(equipeSelect, {
      childList: true,
      subtree: true
    });

    // Verificação imediata inicial (caso o paciente já esteja selecionado)
    this.checkAndTriggerAutofill();
  }

  /**
   * Executa a checagem e dispara o preenchimento se detectado um novo paciente
   */
  private async checkAndTriggerAutofill() {
    if (this.isProcessingAutofill) return;

    // Verificar se há paciente selecionado
    const patientSelect = document.querySelector('[id="agtr.usuarioServico.isenPK"]') as HTMLSelectElement | null;
    const patientId = patientSelect?.value || '';

    // Se não há paciente selecionado ou é o mesmo que acabamos de processar, ignora
    if (!patientId || patientId === '' || patientId === '0' || patientId === this.lastProcessedPatientId) {
      return;
    }

    // Tenta identificar o ESF a partir das opções carregadas na Equipe
    const esfCode = this.detectEsfFromEquipeOptions();
    if (!esfCode) return;

    this.lastProcessedPatientId = patientId;
    this.isProcessingAutofill = true;

    try {
      await this.executeAutoFill(esfCode);
    } catch (err) {
      console.error('SIGSS+: Falha no preenchimento automático:', err);
    } finally {
      this.isProcessingAutofill = false;
    }
  }

  /**
   * Varre as opções do select de equipe buscando por termos como "ESF 087" ou similar
   */
  private detectEsfFromEquipeOptions(): string | null {
    const equipeSelect = document.querySelector(SIGSS_SELECTORS.equipeSelect) as HTMLSelectElement | null;
    if (!equipeSelect) return null;

    const regexEsf = /(?:ESF|Equipe(?:\s+ESF)?|Sa\u00fade\s+da\s+Fam\u00edlia|INE)[:\-\s#\b]+(\d+)/i;

    for (let i = 0; i < equipeSelect.options.length; i++) {
      const text = equipeSelect.options[i].text;
      const match = text.match(regexEsf);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Executa o autopreenchimento com delays controlados
   */
  private async executeAutoFill(esfCode: string) {
    const config = await ConfigManager.getAll();
    const mapping = config.esfMappings[esfCode];

    if (!mapping) {
      console.log(`SIGSS+: Nenhum perfil salvo para a equipe ESF ${esfCode}.`);
      return;
    }

    console.log(`SIGSS+: Perfil localizado para ESF ${esfCode}. Preenchendo...`);

    // Passo 1: Profissional
    if (mapping.profissionalId) {
      SigssAdapter.setSelectValueAndTrigger(SIGSS_SELECTORS.profissionalSelect, mapping.profissionalId);
    }

    // Passo 2: Equipe
    setTimeout(() => {
      if (mapping.equipeId) {
        SigssAdapter.setSelectValueAndTrigger(SIGSS_SELECTORS.equipeSelect, mapping.equipeId);
      }

      // Passo 3: CBO
      setTimeout(() => {
        if (mapping.cboId) {
          SigssAdapter.setSelectValueAndTrigger(SIGSS_SELECTORS.cboSelect, mapping.cboId);
        }
        console.log('SIGSS+: Preenchimento automático concluído com sucesso!');
      }, 300);
    }, 300);
  }

  private injectCaptureButton() {
    SigssAdapter.injectCaptureButton(() => {
      this.handleCaptureConfig();
    });
  }

  private async handleCaptureConfig() {
    // 1. Tentar capturar ESF das opções carregadas na Equipe (altamente confiável)
    let esfCode = this.detectEsfFromEquipeOptions();
    
    // 2. Fallback para varreduras de texto no prontuário
    if (!esfCode) {
      esfCode = SigssAdapter.getPatientEsf();
    }

    const btn = document.getElementById('sigss-plus-capture-btn') as HTMLButtonElement | null;

    if (!esfCode) {
      alert('SIGSS+: Não foi possível determinar a equipe ESF do paciente.\nVerifique se o paciente possui prontuário ativo com ESF vinculada.');
      return;
    }

    const { profissionalSelect, equipeSelect, cboSelect } = SigssAdapter.getLaunchFields();

    if (!profissionalSelect || !equipeSelect || !cboSelect) {
      alert('SIGSS+: Campos do formulário não encontrados.');
      return;
    }

    const profissionalId = profissionalSelect.value;
    const equipeId = equipeSelect.value;
    const cboId = cboSelect.value;

    if (!profissionalId || profissionalId === '' || profissionalId === '0' ||
        !equipeId || equipeId === '' || equipeId === '0' ||
        !cboId || cboId === '' || cboId === '0') {
      alert('SIGSS+: Selecione opções válidas para Profissional, Equipe e CBO antes de capturar.');
      return;
    }

    const profissionalNome = profissionalSelect.options[profissionalSelect.selectedIndex]?.text.trim() || profissionalId;
    const equipeNome = equipeSelect.options[equipeSelect.selectedIndex]?.text.trim() || equipeId;
    const cboNome = cboSelect.options[cboSelect.selectedIndex]?.text.trim() || cboId;

    const mapping: EsfMapping = {
      profissionalId,
      equipeId,
      cboId,
      profissionalNome,
      equipeNome,
      cboNome
    };

    await ConfigManager.saveEsfMapping(esfCode, mapping);

    if (btn) {
      const originalText = btn.textContent;
      const originalBg = btn.style.backgroundColor;
      
      btn.textContent = `✓ ESF ${esfCode} Capturada!`;
      btn.style.backgroundColor = '#d4edda';
      btn.style.borderColor = '#c3e6cb';
      btn.style.color = '#155724';

      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.backgroundColor = originalBg;
        btn.style.borderColor = '#b5b5b5';
        btn.style.color = '#333';
      }, 2000);
    }
  }
}

