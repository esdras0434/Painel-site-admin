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
// 🔹 Variáveis globais
// ==========================
const inputBusca = document.getElementById("buscaFuncionario");
const sugestoesBox = document.getElementById("sugestoes");
let funcionarios = [];
let cpfSelecionado = null;

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
// 🔹 Buscar pontos
// ==========================
async function buscarPontos() {
  const cpfTexto = inputBusca.value.match(/\(([^)]+)\)$/);
  const cpf = cpfTexto ? cpfTexto[1] : inputBusca.value.trim();
  cpfSelecionado = cpf;

  if (!cpf) {
    alert("Selecione um funcionário válido!");
    return;
  }

  const filtroDia = document.getElementById("filtroData").value;
  const filtroMes = document.getElementById("filtroMes").value;

  try {
    const colRef = collection(db, "pontos");
    const q = query(colRef, where("cpf", "==", cpf));
    const snapshot = await getDocs(q);

    const pontosPorData = {};

    snapshot.forEach((doc) => {
      const d = doc.data();
      if (!d.data) return;

      if (filtroDia && d.data !== filtroDia) return;
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

    Object.keys(pontosPorData)
      .sort((a, b) => new Date(a) - new Date(b))
      .forEach((data) => {
        const ponto = pontosPorData[data];
        tabelaCorpo.innerHTML += `
          <tr>
            <td>${formatarData(data)}</td>
            <td data-tipo="entrada_manha">${ponto.entrada_manha}</td>
            <td data-tipo="saida_almoco">${ponto.saida_almoco}</td>
            <td data-tipo="retorno_almoco">${ponto.retorno_almoco}</td>
            <td data-tipo="saida_tarde">${ponto.saida_tarde}</td>
          </tr>
        `;
      });
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

document.addEventListener("click", async (e) => {
  const td = e.target.closest("td");
  if (!td || td.closest("thead")) return;

  const tipo = td.dataset.tipo;
  if (!tipo) return;

  celulaSelecionada = td;
  const tr = td.parentElement;
  dataSelecionada = tr.children[0].textContent.trim(); // dd/mm/yyyy
  tipoSelecionado = tipo;

  // Valor atual da célula
  const valor = td.textContent.trim() !== "-" ? td.textContent.trim() : "";
  document.getElementById("campoValor").value = valor;
  document.getElementById("popupTitulo").textContent = valor
    ? "Editar Ponto"
    : "Adicionar Ponto";

  const dataFirestore = dataSelecionada.split("/").reverse().join("-");

  // Busca do documento correspondente no Firestore
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

  // Exibe o popup
  const overlay = document.getElementById("popupOverlay");
  overlay.style.display = "flex";

  // Adiciona listener para fechar ao clicar fora do popup
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      fecharPopup();
    }
  });
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


