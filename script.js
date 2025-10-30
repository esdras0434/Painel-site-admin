// Importa o 'db' e as funções do módulo centralizado
import { 
    db, collection, getDocs, query, where, 
    addDoc, updateDoc, deleteDoc, doc 
} from './firebase-config.js';

// ==========================
// 🔹 Seletores do DOM e Variáveis Globais
// ==========================
const painelPendentes = document.getElementById("painelPendentes");
const listaPendentes = document.getElementById("listaPendentes");
const btnAbrirPendentes = document.getElementById("btnAbrirPendentes");
const btnFecharPendentes = document.getElementById("btnFecharPendentes");

const inputBusca = document.getElementById("buscaFuncionario");
const sugestoesBox = document.getElementById("sugestoes");
const overlay = document.getElementById("popupOverlay");
const popupTitulo = document.getElementById("popupTitulo");
const campoValor = document.getElementById("campoValor");
const tabelaCorpo = document.querySelector("#tabelaPontos tbody");
const nomeFuncionarioEl = document.getElementById("nomeFuncionario");
const totalTrabalhadasEl = document.getElementById("totalTrabalhadas");
const totalExtrasEl = document.getElementById("totalExtras");
const msgEl = document.getElementById("systemMsg");

let funcionarios = [];
let cpfSelecionado = null;
let funcionarioSelecionadoNome = "";

let celulaSelecionada = null;
let dataSelecionada = null;
let tipoSelecionado = null;
let docIdSelecionado = null; // ID do documento de ponto no Firestore

// Constante para jornada de trabalho padrão (em minutos)
const JORNADA_PADRAO_MINUTOS = 8 * 60; // 8 horas

// ==========================
// 🔹 Funções Auxiliares
// ==========================

/**
 * Exibe uma mensagem de sucesso ou erro no painel.
 * @param {string} mensagem - O texto a ser exibido.
 * @param {string} tipo - 'sucesso' ou 'erro'.
 */
function showSystemMessage(mensagem, tipo = 'sucesso') {
    msgEl.textContent = mensagem;
    msgEl.className = `system-message ${tipo}`;
    msgEl.style.display = 'block';

    // Esconde a mensagem após 5 segundos
    setTimeout(() => {
        msgEl.style.display = 'none';
    }, 5000);
}

/**
 * Formata data de AAAA-MM-DD para DD/MM/AAAA.
 */
function formatarData(dataStr) {
  const partes = dataStr.split("-");
  if (partes.length !== 3) return dataStr;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

/**
 * Converte HH:MM:SS ou HH:MM para minutos totais.
 */
function horaParaMinutos(horaStr) {
    if (!horaStr || horaStr === '-') return 0;
    const partes = horaStr.split(':').map(Number);
    let minutos = 0;
    if (partes.length >= 2) {
        minutos = partes[0] * 60 + partes[1];
    }
    return minutos;
}

/**
 * Converte minutos totais para formato HH:MM.
 */
function minutosParaHora(minutosTotais) {
    if (minutosTotais === 0) return "00:00";
    const horas = Math.floor(minutosTotais / 60);
    const minutos = minutosTotais % 60;
    return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
}

/**
 * Calcula horas trabalhadas e extras com base nos 4 pontos.
 */
function calcularHoras(ponto) {
    const m1 = horaParaMinutos(ponto.entrada_manha);
    const m2 = horaParaMinutos(ponto.saida_almoco);
    const m3 = horaParaMinutos(ponto.retorno_almoco);
    const m4 = horaParaMinutos(ponto.saida_tarde);

    let minutosTrabalhados = 0;
    let minutosExtras = 0;

    // Só calcula se tiver os 4 pontos
    if (m1 > 0 && m2 > 0 && m3 > 0 && m4 > 0) {
        const periodoManha = m2 - m1;
        const periodoTarde = m4 - m3;
        minutosTrabalhados = periodoManha + periodoTarde;

        if (minutosTrabalhados > JORNADA_PADRAO_MINUTOS) {
            minutosExtras = minutosTrabalhados - JORNADA_PADRAO_MINUTOS;
        }
    }

    return {
        trabalhadas: minutosParaHora(minutosTrabalhados),
        extras: minutosParaHora(minutosExtras),
        trabalhadasMin: minutosTrabalhados,
        extrasMin: minutosExtras
    };
}

// ==========================
// 🔹 Carregamento Inicial
// ==========================

/**
 * Carrega a lista de funcionários do Firestore para o autocomplete.
 */
async function carregarFuncionarios() {
  try {
    const colRef = collection(db, "funcionarios");
    const snapshot = await getDocs(colRef);
    funcionarios = snapshot.docs.map((doc) => doc.data());
  } catch (e) {
    console.error("Erro carregando funcionários:", e);
    showSystemMessage("Erro fatal ao carregar funcionários.", 'erro');
  }
}
// Carrega os funcionários assim que a página abre
carregarFuncionarios();

// ==========================
// 🔹 Autocomplete
// ==========================
inputBusca.addEventListener("input", () => {
  const termo = inputBusca.value.toLowerCase();
  sugestoesBox.innerHTML = "";
  sugestoesBox.style.display = termo ? 'block' : 'none';

  if (!termo) return;

  const encontrados = funcionarios.filter(
    (f) => f.nome.toLowerCase().includes(termo) || f.cpf.includes(termo)
  );

  encontrados.slice(0, 5).forEach((f) => {
    const div = document.createElement("div");
    div.textContent = `${f.nome} (${f.cpf})`;
    div.onclick = () => {
      inputBusca.value = `${f.nome} (${f.cpf})`;
      sugestoesBox.innerHTML = "";
      sugestoesBox.style.display = 'none';
      cpfSelecionado = f.cpf;
      funcionarioSelecionadoNome = f.nome;
    };
    sugestoesBox.appendChild(div);
  });
});

// Fecha sugestões se clicar fora
document.addEventListener('click', (e) => {
    if (!inputBusca.contains(e.target) && !sugestoesBox.contains(e.target)) {
        sugestoesBox.style.display = 'none';
    }
});


// ==========================
// 🔹 Busca e Renderização da Tabela
// ==========================

/**
 * Busca os pontos do funcionário selecionado e renderiza a tabela.
 */
async function buscarPontos() {
    // Validação do CPF (pega da variável global ou tenta extrair do input)
    const cpfTexto = inputBusca.value.match(/\(([^)]+)\)$/);
    const cpfInput = cpfTexto ? cpfTexto[1] : inputBusca.value.trim();

    if (cpfInput && !cpfSelecionado) {
         cpfSelecionado = cpfInput;
         const func = funcionarios.find(f => f.cpf === cpfInput);
         funcionarioSelecionadoNome = func ? func.nome : "Funcionário";
    }

    if (!cpfSelecionado) {
        showSystemMessage("Selecione um funcionário válido da lista.", 'erro');
        return;
    }

  const filtroDia = document.getElementById("filtroData").value;
  const filtroMes = document.getElementById("filtroMes").value;

  try {
    const colRef = collection(db, "pontos");
    // Query busca todos os pontos do CPF
    const q = query(colRef, where("cpf", "==", cpfSelecionado));
    const snapshot = await getDocs(q);

    const pontosPorData = {};
    let totalMinTrabalhados = 0;
    let totalMinExtras = 0;

    snapshot.forEach((doc) => {
      const d = doc.data();
      if (!d.data) return;

      // Filtros de data (se aplicados)
      if (filtroDia && d.data !== filtroDia) return;
      if (filtroMes && !d.data.startsWith(filtroMes)) return;

      // Agrupa os pontos por data
      if (!pontosPorData[d.data]) {
        pontosPorData[d.data] = {
          entrada_manha: "-",
          saida_almoco: "-",
          retorno_almoco: "-",
          saida_tarde: "-",
        };
      }
      pontosPorData[d.data][d.tipo] = d.hora || "-";
    });

    tabelaCorpo.innerHTML = ""; // Limpa a tabela
    
    // Define o nome no cabeçalho
    nomeFuncionarioEl.textContent = `Funcionário: ${funcionarioSelecionadoNome}`;

    const datasOrdenadas = Object.keys(pontosPorData).sort((a, b) => new Date(a) - new Date(b));

    if (datasOrdenadas.length === 0) {
        tabelaCorpo.innerHTML = `<tr><td colspan="7">Nenhum ponto encontrado para este funcionário no período.</td></tr>`;
        totalTrabalhadasEl.textContent = "00:00";
        totalExtrasEl.textContent = "00:00";
        return;
    }

    // Renderiza as linhas da tabela
    datasOrdenadas.forEach((data) => {
        const ponto = pontosPorData[data];
        // Calcula as horas para esta linha
        const horas = calcularHoras(ponto);

        totalMinTrabalhados += horas.trabalhadasMin;
        totalMinExtras += horas.extrasMin;

        const row = document.createElement('tr');
        // Adiciona data-full-date para facilitar a busca no popup
        row.setAttribute('data-full-date', data); 
        row.innerHTML = `
          <td>${formatarData(data)}</td>
          <td data-tipo="entrada_manha">${ponto.entrada_manha}</td>
          <td data-tipo="saida_almoco">${ponto.saida_almoco}</td>
          <td data-tipo="retorno_almoco">${ponto.retorno_almoco}</td>
          <td data-tipo="saida_tarde">${ponto.saida_tarde}</td>
          <td class="total-hours">${horas.trabalhadas}</td>
          <td class="extra-hours">${horas.extras}</td>
        `;
        tabelaCorpo.appendChild(row);
    });

    // Atualiza os totais no rodapé
    totalTrabalhadasEl.textContent = minutosParaHora(totalMinTrabalhados);
    totalExtrasEl.textContent = minutosParaHora(totalMinExtras);

  } catch (e) {
    console.error("Erro buscando pontos:", e);
    showSystemMessage("Erro ao buscar registros de ponto.", 'erro');
  }
}
// Expõe a função para o botão (onclick)
window.buscarPontos = buscarPontos;

// ==========================
// 🔹 Popup (Adicionar/Editar/Excluir Ponto)
// ==========================

/**
 * Recalcula as horas da linha específica que foi modificada.
 */
function recalcularLinha(linhaElement) {
    const ponto = {
        entrada_manha: linhaElement.children[1].textContent,
        saida_almoco: linhaElement.children[2].textContent,
        retorno_almoco: linhaElement.children[3].textContent,
        saida_tarde: linhaElement.children[4].textContent,
    };
    const horas = calcularHoras(ponto);
    linhaElement.children[5].textContent = horas.trabalhadas;
    linhaElement.children[6].textContent = horas.extras;

    // Recalcula o total geral
    recalcularTotaisTabela();
}

/**
 * Recalcula os totais no footer da tabela.
 */
function recalcularTotaisTabela() {
    let totalMinTrabalhados = 0;
    let totalMinExtras = 0;
    
    tabelaCorpo.querySelectorAll('tr').forEach(row => {
        // Verifica se a linha tem 7 colunas (ignora a linha de "nenhum dado")
        if (row.children.length === 7) {
            const trabMin = horaParaMinutos(row.children[5].textContent);
            const extraMin = horaParaMinutos(row.children[6].textContent);
            totalMinTrabalhados += trabMin;
            totalMinExtras += extraMin;
        }
    });

    totalTrabalhadasEl.textContent = minutosParaHora(totalMinTrabalhados);
    totalExtrasEl.textContent = minutosParaHora(totalMinExtras);
}

/**
 * Fecha o popup de edição.
 */
function fecharPopup() {
  overlay.classList.remove('ativo');
  celulaSelecionada = null;
  docIdSelecionado = null;
  dataSelecionada = null;
  tipoSelecionado = null;
}

// Evento para fechar o popup clicando fora (no overlay)
overlay.addEventListener("click", (event) => {
  if (event.target === overlay) {
    fecharPopup();
  }
});

// Evento para fechar no botão "Cancelar"
document.getElementById("btnFechar").addEventListener("click", fecharPopup);

// Evento principal da tabela (Delegação de Eventos)
tabelaCorpo.addEventListener("click", async (e) => {
  const td = e.target.closest("td");
  // Ignora cliques fora de TDs, no cabeçalho, ou nas colunas de data/totais
  if (!td || td.closest("thead") || !td.dataset.tipo) return;

  if (!cpfSelecionado) {
      showSystemMessage("Busque por um funcionário antes de editar.", "erro");
      return;
  }

  celulaSelecionada = td;
  const tr = td.parentElement;
  // Pega a data AAAA-MM-DD do atributo data-full-date
  dataSelecionada = tr.dataset.fullDate; 
  tipoSelecionado = td.dataset.tipo;

  const valor = td.textContent.trim();
  campoValor.value = (valor !== "-") ? valor : "";
  
  popupTitulo.textContent = (valor !== "-") 
    ? "Editar Ponto" 
    : "Adicionar Ponto";

  // Busca o ID do documento no Firestore para saber se é Add ou Update
  try {
    const q = query(
      collection(db, "pontos"),
      where("cpf", "==", cpfSelecionado),
      where("data", "==", dataSelecionada),
      where("tipo", "==", tipoSelecionado)
    );
    const snap = await getDocs(q);
    docIdSelecionado = snap.empty ? null : snap.docs[0].id;
  } catch (err) {
    console.error("Erro ao buscar documento:", err);
    docIdSelecionado = null;
  }

  // Abre o popup
  overlay.classList.add('ativo');
});


// Evento do botão "Salvar" no popup
document.getElementById("btnSalvar").addEventListener("click", async () => {
  if (!celulaSelecionada || !cpfSelecionado || !dataSelecionada) return;

  const novoValor = campoValor.value.trim();
  if (!novoValor) {
    showSystemMessage("Informe um horário válido (HH:MM ou HH:MM:SS).", 'erro');
    return;
  }

  try {
    // Se temos um ID, é uma ATUALIZAÇÃO (Update)
    if (docIdSelecionado) {
      await updateDoc(doc(db, "pontos", docIdSelecionado), { hora: novoValor });
    } else {
    // Se não, é um NOVO PONTO (Add)
      const novoDoc = await addDoc(collection(db, "pontos"), {
        cpf: cpfSelecionado,
        data: dataSelecionada,
section
        tipo: tipoSelecionado,
        hora: novoValor,
      });
      docIdSelecionado = novoDoc.id; // Armazena o ID caso queira excluir em seguida
    }

    celulaSelecionada.textContent = novoValor;
    recalcularLinha(celulaSelecionada.parentElement);
    showSystemMessage("Ponto salvo com sucesso!", 'sucesso');
  } catch (err) {
    console.error("Erro ao salvar:", err);
    showSystemMessage("Erro ao salvar no banco de dados!", 'erro');
  }

  fecharPopup();
});

// Evento do botão "Excluir" no popup
document.getElementById("btnExcluir").addEventListener("click", async () => {
  if (!celulaSelecionada) return;

  // Só pode excluir se o ponto existir no DB
  if (!docIdSelecionado) {
    showSystemMessage("Este ponto ainda não foi salvo, não há o que excluir.", "erro");
    fecharPopup();
    return;
  }

  try {
    await deleteDoc(doc(db, "pontos", docIdSelecionado));
    celulaSelecionada.textContent = "-";
    recalcularLinha(celulaSelecionada.parentElement);
    showSystemMessage("Ponto excluído com sucesso!", 'sucesso');
  } catch (err) {
    console.error("Erro ao excluir:", err);
    showSystemMessage("Erro ao excluir do banco de dados!", 'erro');
  }

  fecharPopup();
});

// ==========================
// 🔹 Painel de Pendentes
// ==========================
btnAbrirPendentes.addEventListener("click", () => carregarPendentes());
btnFecharPendentes.addEventListener("click", () =>
  painelPendentes.classList.remove("ativo")
);

async function carregarPendentes() {
  painelPendentes.classList.add("ativo");
  listaPendentes.innerHTML = "<p>Carregando...</p>";

  const hoje = new Date().toISOString().split("T")[0]; // formato YYYY-MM-DD
  const colRef = collection(db, "pontos");

  try {
    // Garante que a lista de funcionários está carregada
    if (funcionarios.length === 0) await carregarFuncionarios();

    const snapshot = await getDocs(query(colRef, where("data", "==", hoje)));

    // Mapeia todos os pontos de HOJE por CPF
    const pontosHoje = {};
    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      if (!pontosHoje[d.cpf]) pontosHoje[d.cpf] = {};
      pontosHoje[d.cpf][d.tipo] = d.hora;
    });

    const tiposDePonto = ["entrada_manha", "saida_almoco", "retorno_almoco", "saida_tarde"];

    // Verifica pendências comparando com a lista de funcionários
    const pendentes = funcionarios
      .map((f) => {
        const p = pontosHoje[f.cpf] || {};
        const faltando = tiposDePonto.filter((t) => !p[t]);
        return { nome: f.nome, cpf: f.cpf, faltando };
      })
      .filter((p) => p.faltando.length > 0); // Filtra apenas quem tem pendências

    if (pendentes.length === 0) {
      listaPendentes.innerHTML = "<p>Todos os funcionários estão em dia ✅</p>";
      return;
    }

    listaPendentes.innerHTML = pendentes
      .map(
        (p) => `
        <div>
          <strong>${p.nome}</strong> (${p.cpf})<br>
          <small>Faltando: ${p.faltando.join(", ")}</small>
        </div>
      `
      )
      .join("");
  } catch (e) {
    console.error("Erro ao carregar pendentes:", e);
    listaPendentes.innerHTML = "<p>Erro ao carregar dados.</p>";
  }
}

// ==========================
// 🔹 Exportar PDF (jsPDF) - CORRIGIDO
// ==========================
async function exportarPDF() {
    if (!cpfSelecionado || !funcionarioSelecionadoNome) {
        showSystemMessage("Primeiro, busque por um funcionário para gerar o PDF.", "erro");
        return;
    }

    // 1. Verificar se as bibliotecas jsPDF e autoTable estão carregadas
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.autoTable === 'undefined') {
        console.error("jsPDF ou jsPDF-AutoTable não carregou.");
        showSystemMessage("Erro ao carregar a biblioteca PDF. Tente recarregar a página.", "erro");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // --- Adicionar Títulos e Informações ---
    doc.setFontSize(18);
    doc.text(`Espelho de Ponto: ${funcionarioSelecionadoNome}`, 14, 22);
    doc.setFontSize(12);
    doc.text(`CPF: ${cpfSelecionado}`, 14, 30);
    
    const filtroDia = document.getElementById("filtroData").value;
    const filtroMes = document.getElementById("filtroMes").value;
    let periodo = "Período: Completo";
    if (filtroDia) periodo = `Período: ${formatarData(filtroDia)}`;
    if (filtroMes) {
        const [ano, mes] = filtroMes.split('-');
        periodo = `Período: ${mes}/${ano}`;
    }
    doc.text(periodo, 14, 36);

    // --- 2. Ler os dados da tabela manualmente ---
    const tabela = document.getElementById('tabelaPontos');
    const head = [];
    const body = [];
    const foot = [];

    // Cabeçalho (lê a segunda linha do thead, que contém os títulos corretos)
    tabela.querySelectorAll('thead tr:last-child th').forEach(th => {
        head.push(th.innerText);
    });

    // Corpo
    tabela.querySelectorAll('tbody tr').forEach(tr => {
        // Ignora a linha de "Nenhum dado"
        if (tr.children.length === 1 && tr.children[0].getAttribute('colspan') === '7') {
            return; 
        }
        const rowData = [];
        tr.querySelectorAll('td').forEach(td => {
            rowData.push(td.innerText);
        });
        body.push(rowData);
    });

    // Rodapé
    tabela.querySelectorAll('tfoot tr').forEach(tr => {
        const footData = [];
        tr.querySelectorAll('td').forEach(td => {
            // Adiciona estilos para o rodapé
            footData.push({ 
                content: td.innerText, 
                styles: { 
                    fontStyle: 'bold', 
                    halign: td.style.textAlign || 'center' 
                } 
            });
        });
        foot.push(footData);
    });

    if (body.length === 0) {
         showSystemMessage("Não há dados na tabela para exportar.", "erro");
         return;
    }

    // --- 3. Gerar o PDF com os dados manuais ---
    doc.autoTable({
        startY: 40,
        head: [head], // 'head' espera um array de arrays
        body: body,
        foot: foot, // 'foot' espera um array de arrays
        theme: 'grid', // Tema 'grid' é limpo e profissional
        headStyles: { 
            fillColor: [25, 118, 210], // Azul do seu novo CSS
            textColor: [255, 255, 255] 
        },
        footStyles: { 
            fillColor: [245, 245, 245], 
            textColor: [0, 0, 0] 
        },
        // Adiciona as cores de fundo das colunas (como no seu CSS)
        didParseCell: function (data) {
            if (data.section === 'body') {
                const col = data.column.index;
                if (col === 1) data.cell.styles.fillColor = '#e3f2fd';
                if (col === 2) data.cell.styles.fillColor = '#f1f8e9';
                if (col === 3) data.cell.styles.fillColor = '#fff8e1';
                if (col === 4) data.cell.styles.fillColor = '#fbe9e7';
                if (col === 5) data.cell.styles.fillColor = '#f3e5f5';
                if (col === 6) data.cell.styles.fillColor = '#ede7f6';
            }
        }
    });

    // --- 4. Salvar o arquivo ---
    const nomeArquivo = `pontos_${funcionarioSelecionadoNome.replace(/ /g, '_')}_${filtroMes || filtroDia || 'total'}.pdf`;
    doc.save(nomeArquivo);
}
// Expõe a função para o botão (onclick)
window.exportarPDF = exportarPDF;

