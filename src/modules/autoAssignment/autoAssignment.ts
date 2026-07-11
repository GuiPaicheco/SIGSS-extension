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
  
  public async start() {
    const esfCode = SigssAdapter.getPatientEsf();
    
    // Injetar o botão "Capturar Configuração" independente de ter localizado o ESF,
    // pois o usuário pode interagir. Trataremos se o ESF não existir no momento do clique.
    this.injectCaptureButton();

    if (!esfCode) {
      console.log('SIGSS+: Código ESF do paciente não encontrado nesta página.');
      return;
    }

    console.log(`SIGSS+: Código ESF do paciente detectado: ${esfCode}`);

    // Executa preenchimento automático caso haja mapeamento registrado
    await this.executeAutoFill(esfCode);
  }

  public stop() {
    const btn = document.getElementById('sigss-plus-capture-btn');
    if (btn) {
      btn.remove();
    }
  }

  /**
   * Preenche de forma inteligente os dropdowns disparando eventos change sequenciais
   * com pequenos atrasos (delays) para permitir que scripts AJAX do SIGSS respondam.
   */
  private async executeAutoFill(esfCode: string) {
    const config = await ConfigManager.getAll();
    const mapping = config.esfMappings[esfCode];

    if (!mapping) {
      console.log(`SIGSS+: Nenhum mapeamento de lançamento configurado para a Equipe ESF ${esfCode}.`);
      return;
    }

    const { profissionalSelect, equipeSelect, cboSelect } = SigssAdapter.getLaunchFields();

    if (!profissionalSelect && !equipeSelect && !cboSelect) {
      console.warn('SIGSS+: Nenhum campo de seleção de lançamento encontrado na página.');
      return;
    }

    console.log(`SIGSS+: Iniciando preenchimento automático para ESF ${esfCode}...`);

    // Passo 1: Preencher Profissional
    if (mapping.profissionalId) {
      SigssAdapter.setSelectValueAndTrigger(SIGSS_SELECTORS.profissionalSelect, mapping.profissionalId);
    }

    // Passo 2: Aguardar 300ms para preencher a Equipe
    setTimeout(() => {
      if (mapping.equipeId) {
        SigssAdapter.setSelectValueAndTrigger(SIGSS_SELECTORS.equipeSelect, mapping.equipeId);
      }

      // Passo 3: Aguardar mais 300ms para preencher o CBO
      setTimeout(() => {
        if (mapping.cboId) {
          SigssAdapter.setSelectValueAndTrigger(SIGSS_SELECTORS.cboSelect, mapping.cboId);
        }
        console.log('SIGSS+: Lançamento preenchido automaticamente.');
      }, 300);
    }, 300);
  }


  /**
   * Injeta o botão de Captura e configura seu evento
   */
  private injectCaptureButton() {
    SigssAdapter.injectCaptureButton(() => {
      this.handleCaptureConfig();
    });
  }

  /**
   * Captura as escolhas atuais do usuário e as associa à equipe ESF do paciente
   */
  private async handleCaptureConfig() {
    const esfCode = SigssAdapter.getPatientEsf();
    const btn = document.getElementById('sigss-plus-capture-btn') as HTMLButtonElement | null;

    if (!esfCode) {
      alert('SIGSS+: Não foi possível identificar a Equipe ESF do paciente nesta tela.\nO prontuário do paciente precisa exibir o código ou nome da Equipe ESF.');
      return;
    }

    const { profissionalSelect, equipeSelect, cboSelect } = SigssAdapter.getLaunchFields();

    if (!profissionalSelect || !equipeSelect || !cboSelect) {
      alert('SIGSS+: Os campos de seleção (Profissional, Equipe ou CBO) não foram encontrados na página.');
      return;
    }

    const profissionalId = profissionalSelect.value;
    const equipeId = equipeSelect.value;
    const cboId = cboSelect.value;

    // Validação de preenchimento (evitar valores vazios, iniciais ou inválidos)
    if (!profissionalId || profissionalId === '' || profissionalId === '0' || profissionalId === '-1' ||
        !equipeId || equipeId === '' || equipeId === '0' || equipeId === '-1' ||
        !cboId || cboId === '' || cboId === '0' || cboId === '-1') {
      alert('SIGSS+: Selecione opções válidas para Profissional, Equipe e CBO antes de capturar a configuração.');
      return;
    }

    // Obter textos descritivos das opções para exibição amigável nas opções
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

    // Salvar configuração associada à equipe ESF encontrada
    await ConfigManager.saveEsfMapping(esfCode, mapping);

    // Efeito de feedback visual no botão de forma discreta e elegante
    if (btn) {
      const originalText = btn.textContent;
      const originalBg = btn.style.backgroundColor;
      const originalBorder = btn.style.borderColor;
      const originalColor = btn.style.color;

      btn.textContent = '✓ Configuração Capturada!';
      btn.style.backgroundColor = '#d4edda';
      btn.style.borderColor = '#c3e6cb';
      btn.style.color = '#155724';

      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.backgroundColor = originalBg;
        btn.style.borderColor = originalBorder;
        btn.style.color = originalColor;
      }, 2000);
    }
  }
}
