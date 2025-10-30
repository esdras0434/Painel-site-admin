import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ==========================
// 🔹 Configuração Firebase
// ==========================
const firebaseConfig = {
  apiKey: "AIzaSyCuCbBesvbrOvdzdv1cmCF7M2uaaUfWRU0",
  authDomain: "meupontoapp-d5d3b.firebaseapp.com",
  projectId: "meupontoapp-d5d3b",
  storageBucket: "meupontoapp-d5d3b.appspot.com",
  messagingSenderId: "700159340275",
  appId: "1:700159340275:web:51094e94b4159521cf5186",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==========================
// 🔹 Painel de Pontos Pendentes
// ==========================
const painelPendentes = document.getElementById("painelPendentes");
const listaPendentes = document.getElementById("listaPendentes");
const btnAbrirPendentes = document.getElementById("btnAbrirPendentes");
const btnFecharPendentes = document.getElementById("btnFecharPendentes");

// ==========================
// 🔹 Variáveis globais
// ==========================
const inputBusca = document.getElementById("buscaFuncionario");
const sugestoesBox = document.getElementById("sugestoes");
let funcionarios = [];
let cpfSelecionado = null;
const overlay = document.getElementById("popupOverlay");


// ==========================
// 🔹 Funções auxiliares
// ==========================
function formatarData(dataStr) {
  const partes = dataStr.split("-");
  if (partes.length !== 3) return dataStr;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

// ==========================
// 🔹 Carregar funcionários
// ==========================
async function carregarFuncionarios() {
  try {
    const colRef = collection(db, "funcionarios");
    const snapshot = await getDocs(colRef);

    funcionarios = snapshot.docs.map((doc) => doc.data());
  } catch (e) {
    console.error("Erro carregando funcionários:", e);
  }
}
carregarFuncionarios();

// ==========================
// 🔹 Autocomplete
// ==========================
inputBusca.addEventListener("input", () => {
  const termo = inputBusca.value.toLowerCase();
  sugestoesBox.innerHTML = "";

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
      cpfSelecionado = f.cpf;
    };
    sugestoesBox.appendChild(div);
  });
});

// ==========================
// 🔹 Buscar pontos (VERSÃO ATUALIZADA)
// ==========================
async function buscarPontos() {
  const cpfTexto = inputBusca.value.match(/\(([^)]+)\)$/);
  const cpf = cpfTexto ? cpfTexto[1] : inputBusca.value.trim();
  cpfSelecionado = cpf;

  if (!cpf) {
    alert("Selecione um funcionário válido!");
    return;
  }

  // O filtro de mês agora é obrigatório
  const filtroMes = document.getElementById("filtroMes").value; // Formato "YYYY-MM"
  if (!filtroMes) {
    alert("Por favor, selecione um MÊS para gerar o relatório completo.");
    return;
  }

  // O filtro de dia específico não será usado, pois queremos o mês inteiro
  // const filtroDia = document.getElementById("filtroData").value;

  try {
    const colRef = collection(db, "pontos");
    const q = query(colRef, where("cpf", "==", cpf));
    const snapshot = await getDocs(q);

    const pontosPorData = {};

    // 1. Coletar os pontos existentes do Firebase para o mês selecionado
    snapshot.forEach((doc) => {
      const d = doc.data();
      if (!d.data) return;

      // Filtra apenas os pontos do mês selecionado
      if (filtroMes && !d.data.startsWith(filtroMes)) return;

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

    const tabelaCorpo = document.querySelector("#tabelaPontos tbody");
    tabelaCorpo.innerHTML = "";

    const nomeFuncionarioEl = document.getElementById("nomeFuncionario");
    const funcionarioNome =
      funcionarios.find((f) => f.cpf === cpf)?.nome || "Funcionário";
    nomeFuncionarioEl.textContent = `Funcionário: ${funcionarioNome}`;

    // 2. Gerar todos os dias do mês selecionado
    const [ano, mes] = filtroMes.split("-").map(Number);
    
    // new Date(ano, mes, 0) pega o último dia do mês ANTERIOR (que é 'mes - 1' no índice JS)
    // Mas como queremos o último dia do mês 'mes', usamos 'mes' (que vira 'mes - 1' no índice)
    // e o dia 0 do mês SEGUINTE.
    const diasNoMes = new Date(ano, mes, 0).getDate();

    // 3. Iterar por TODOS os dias do mês e construir a tabela
    for (let dia = 1; dia <= diasNoMes; dia++) {
      
      // Criamos um objeto Date para saber o dia da semana
      // new Date() usa mês 0-indexado (0=Jan, 11=Dez), por isso 'mes - 1'
      const dataAtual = new Date(ano, mes - 1, dia);
      const diaDaSemana = dataAtual.getDay(); // 0 = Domingo, 1 = Segunda...

      // Formata a data no padrão "YYYY-MM-DD" para buscar no 'pontosPorData'
      const diaStr = String(dia).padStart(2, "0");
      const mesStr = String(mes).padStart(2, "0");
      const dataChave = `${ano}-${mesStr}-${diaStr}`; // ex: "2025-10-05"

      // Pega o ponto se existir, ou cria um objeto vazio
      const ponto = pontosPorData[dataChave] || {
        entrada_manha: "-",
        saida_almoco: "-",
        retorno_almoco: "-",
        saida_tarde: "-",
      };

      // Define a classe CSS se for domingo
      const classeDomingo = diaDaSemana === 0 ? 'class="domingo"' : '';

      // Adiciona a linha na tabela
      tabelaCorpo.innerHTML += `
        <tr ${classeDomingo}>
          <td>${formatarData(dataChave)}</td>
          <td data-tipo="entrada_manha">${ponto.entrada_manha}</td>
          <td data-tipo="saida_almoco">${ponto.saida_almoco}</td>
          <td data-tipo="retorno_almoco">${ponto.retorno_almoco}</td>
          <td data-tipo="saida_tarde">${ponto.saida_tarde}</td>
        </tr>
      `;
    }
  } catch (e) {
    console.error("Erro buscando pontos:", e);
  }
}
window.buscarPontos = buscarPontos;

// ==========================
// 🔹 Popup de edição
// ==========================
let celulaSelecionada = null;
let dataSelecionada = null;
let tipoSelecionado = null;
let docIdSelecionado = null;

overlay.addEventListener("click", (event) => {
  if (event.target === overlay) {
    fecharPopup();
  }
});

document.addEventListener("click", async (e) => {
  const td = e.target.closest("td");
  if (!td || td.closest("thead")) return;

  const tipo = td.dataset.tipo;
  if (!tipo) return;

  celulaSelecionada = td;
  const tr = td.parentElement;
  dataSelecionada = tr.children[0].textContent.trim();
  tipoSelecionado = tipo;

  const valor = td.textContent.trim() !== "-" ? td.textContent.trim() : "";
  document.getElementById("campoValor").value = valor;
  document.getElementById("popupTitulo").textContent = valor
    ? "Editar Ponto"
    : "Adicionar Ponto";

  const dataFirestore = dataSelecionada.split("/").reverse().join("-");

  try {
    const q = query(
      collection(db, "pontos"),
      where("cpf", "==", cpfSelecionado),
      where("data", "==", dataFirestore),
      where("tipo", "==", tipoSelecionado)
    );
    const snap = await getDocs(q);
    docIdSelecionado = snap.empty ? null : snap.docs[0].id;
  } catch (err) {
    console.error("Erro ao buscar documento:", err);
    docIdSelecionado = null;
  }

  // Somente abre o popup
  overlay.style.display = "flex";
});




function fecharPopup() {
  document.getElementById("popupOverlay").style.display = "none";
  celulaSelecionada = null;
}

document.getElementById("btnFechar").addEventListener("click", fecharPopup);

document.getElementById("btnSalvar").addEventListener("click", async () => {
  if (!celulaSelecionada || !cpfSelecionado) return;

  const novoValor = document.getElementById("campoValor").value.trim();
  if (!novoValor) return alert("Informe um horário válido!");

  const dataFirestore = dataSelecionada.split("/").reverse().join("-");

  try {
    if (docIdSelecionado) {
      await updateDoc(doc(db, "pontos", docIdSelecionado), { hora: novoValor });
    } else {
      await addDoc(collection(db, "pontos"), {
        cpf: cpfSelecionado,
        data: dataFirestore,
        tipo: tipoSelecionado,
        hora: novoValor,
      });
    }

    celulaSelecionada.textContent = novoValor;
    alert("Ponto salvo com sucesso!");
  } catch (err) {
    console.error("Erro ao salvar:", err);
    alert("Erro ao salvar no banco de dados!");
  }

  fecharPopup();
});

document.getElementById("btnExcluir").addEventListener("click", async () => {
  if (!celulaSelecionada) return;

  try {
    if (docIdSelecionado) {
      await deleteDoc(doc(db, "pontos", docIdSelecionado));
    }
    celulaSelecionada.textContent = "-";
    alert("Ponto excluído com sucesso!");
  } catch (err) {
    console.error("Erro ao excluir:", err);
    alert("Erro ao excluir do banco de dados!");
  }

  fecharPopup();
});

btnAbrirPendentes.addEventListener("click", carregarPendentes);
btnFecharPendentes.addEventListener("click", () =>
  painelPendentes.classList.remove("ativo")
);

async function carregarPendentes() {
  painelPendentes.classList.add("ativo");
  listaPendentes.innerHTML = "<p>Carregando...</p>";

  const hoje = new Date().toISOString().split("T")[0]; // formato YYYY-MM-DD
  const colRef = collection(db, "pontos");

  try {
    const snapshot = await getDocs(colRef);

    // Mapeia todos os pontos por CPF e data
    const pontosHoje = {};
    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      if (d.data === hoje) {
        if (!pontosHoje[d.cpf]) pontosHoje[d.cpf] = {};
        pontosHoje[d.cpf][d.tipo] = d.hora;
      }
    });

    // Verifica pendências
    const pendentes = funcionarios
      .filter((f) => {
        const p = pontosHoje[f.cpf] || {};
        const faltando = [
          "entrada_manha",
          "saida_almoco",
          "retorno_almoco",
          "saida_tarde",
        ].filter((t) => !p[t]);
        return faltando.length > 0;
      })
      .map((f) => {
        const p = pontosHoje[f.cpf] || {};
        const faltando = [
          "entrada_manha",
          "saida_almoco",
          "retorno_almoco",
          "saida_tarde",
        ].filter((t) => !p[t]);
        return { nome: f.nome, cpf: f.cpf, faltando };
      });

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








