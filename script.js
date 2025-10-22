import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ==========================
// 🔹 CONFIGURAÇÃO FIREBASE
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
// 🔹 VARIÁVEIS GLOBAIS
// ==========================
const inputBusca = document.getElementById("buscaFuncionario");
const sugestoesBox = document.getElementById("sugestoes");
let funcionarios = [];
let cpfSelecionado = null;

// ==========================
// 🔹 FORMATAR DATA
// ==========================
function formatarData(dataStr) {
  const partes = dataStr.split("-");
  if (partes.length !== 3) return dataStr;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

// ==========================
// 🔹 CARREGAR FUNCIONÁRIOS
// ==========================
async function carregarFuncionarios() {
  try {
    const colRef = collection(db, "funcionarios");
    const snapshot = await getDocs(colRef);

    const lista = [];
    snapshot.forEach((doc) => {
      const d = doc.data();
      if (d.nome && d.cpf) lista.push({ nome: d.nome, cpf: d.cpf });
    });
    funcionarios = lista;
  } catch (e) {
    console.error("Erro carregando funcionários:", e);
  }
}
carregarFuncionarios();

// ==========================
// 🔹 AUTOCOMPLETE
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
    };
    sugestoesBox.appendChild(div);
  });
});

// ==========================
// 🔹 BUSCAR PONTOS
// ==========================
async function buscarPontos() {
  const cpfTexto = inputBusca.value.match(/\(([^)]+)\)$/);
  const cpf = cpfTexto ? cpfTexto[1] : inputBusca.value.trim();
  cpfSelecionado = cpf; // salva para uso no popup

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
      if (d.foto_url) {
        pontosPorData[d.data][`${d.tipo}_foto`] = d.foto_url;
      }
    });

    const tabelaCorpo = document.querySelector("#tabelaPontos tbody");
    tabelaCorpo.innerHTML = "";

    const nomeFuncionarioEl = document.getElementById("nomeFuncionario");
    const funcionarioNome = funcionarios.find((f) => f.cpf === cpf)?.nome || "Funcionário";
    nomeFuncionarioEl.textContent = `Funcionário: ${funcionarioNome}`;

    Object.keys(pontosPorData)
      .sort((a, b) => new Date(a) - new Date(b))
      .forEach((data) => {
        const ponto = pontosPorData[data];
        const mostrarFotos = filtroDia === data;

        function celula(tipo) {
          const hora = ponto[tipo] || "-";
          const foto = ponto[`${tipo}_foto`];
          if (mostrarFotos && foto) {
            return `${hora}<br><a href="${foto}" target="_blank"><img src="${foto}" height="50"/></a>`;
          } else {
            return hora;
          }
        }

        tabelaCorpo.innerHTML += `
          <tr>
            <td>${formatarData(data)}</td>
            <td data-tipo="entrada_manha">${celula("entrada_manha")}</td>
            <td data-tipo="saida_almoco">${celula("saida_almoco")}</td>
            <td data-tipo="retorno_almoco">${celula("retorno_almoco")}</td>
            <td data-tipo="saida_tarde">${celula("saida_tarde")}</td>
          </tr>
        `;
      });
  } catch (e) {
    console.error("Erro buscando pontos:", e);
  }
}
window.buscarPontos = buscarPontos;

// ==========================
// 🔹 EXPORTAR PDF
// ==========================
window.exportarPDF = function () {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const nomeFuncionario = document.getElementById("nomeFuncionario").textContent || "Funcionário";

  doc.setFontSize(16);
  doc.text(nomeFuncionario, 14, 20);

  const headers = [];
  document.querySelectorAll("#tabelaPontos thead tr:nth-child(2) th").forEach((th) => {
    headers.push(th.textContent);
  });

  const data = [];
  document.querySelectorAll("#tabelaPontos tbody tr").forEach((tr) => {
    const row = [];
    tr.querySelectorAll("td").forEach((td) => {
      row.push(td.textContent);
    });
    data.push(row);
  });

  doc.autoTable({
    head: [headers],
    body: data,
    startY: 30,
    theme: "striped",
  });

  doc.save(`pontos_${nomeFuncionario.replace(/\s+/g, "_")}.pdf`);
};

// ===================
// 🔹 POPUP DE EDIÇÃO COMPLETO (com Firebase)
// ===================
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  addDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let celulaSelecionada = null;
let cpfSelecionado = null;
let docIdSelecionado = null;
let dataSelecionada = null;
let tipoSelecionado = null;

// Quando buscar pontos, guarda o CPF do funcionário ativo
window.buscarPontos = async function buscarPontos() {
  const cpfTexto = inputBusca.value.match(/\(([^)]+)\)$/);
  const cpf = cpfTexto ? cpfTexto[1] : inputBusca.value.trim();
  cpfSelecionado = cpf;

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
};

// Abre o popup ao clicar em uma célula
document.addEventListener("click", async (e) => {
  const td = e.target.closest("td");
  if (!td || td.closest("thead")) return;

  const tipo = td.dataset.tipo;
  if (!tipo) return;

  celulaSelecionada = td;
  const tr = td.parentElement;
  dataSelecionada = tr.children[0].textContent.trim(); // dd/mm/yyyy
  tipoSelecionado = tipo;

  const valor = td.textContent.trim() !== "-" ? td.textContent.trim() : "";
  document.getElementById("campoValor").value = valor;
  document.getElementById("popupTitulo").textContent = valor
    ? "Editar Ponto"
    : "Adicionar Ponto";

  // Busca o documento no Firestore (se existir)
  const dataFirestore = dataSelecionada.split("/").reverse().join("-"); // yyyy-mm-dd
  const q = query(
    collection(db, "pontos"),
    where("cpf", "==", cpfSelecionado),
    where("data", "==", dataFirestore),
    where("tipo", "==", tipoSelecionado)
  );
  const snap = await getDocs(q);
  docIdSelecionado = snap.empty ? null : snap.docs[0].id;

  document.getElementById("popupOverlay").style.display = "flex";
});

function fecharPopup() {
  document.getElementById("popupOverlay").style.display = "none";
  celulaSelecionada = null;
}

document.getElementById("btnFechar").addEventListener("click", fecharPopup);

// 🔹 SALVAR (cria ou atualiza no Firebase)
document.getElementById("btnSalvar").addEventListener("click", async () => {
  if (!celulaSelecionada || !cpfSelecionado) return;
  const novoValor = document.getElementById("campoValor").value.trim();
  if (!novoValor) return alert("Informe um horário válido!");

  const dataFirestore = dataSelecionada.split("/").reverse().join("-");

  try {
    if (docIdSelecionado) {
      // Atualiza documento existente
      const docRef = doc(db, "pontos", docIdSelecionado);
      await updateDoc(docRef, { hora: novoValor });
    } else {
      // Cria novo documento
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
    console.error("Erro ao salvar ponto:", err);
    alert("Erro ao salvar no banco de dados!");
  }

  fecharPopup();
});

// 🔹 EXCLUIR (remove do Firebase)
document.getElementById("btnExcluir").addEventListener("click", async () => {
  if (!celulaSelecionada || !docIdSelecionado) {
    celulaSelecionada.textContent = "-";
    fecharPopup();
    return;
  }

  try {
    const docRef = doc(db, "pontos", docIdSelecionado);
    await deleteDoc(docRef);
    celulaSelecionada.textContent = "-";
    alert("Ponto excluído com sucesso!");
  } catch (err) {
    console.error("Erro ao excluir:", err);
    alert("Erro ao excluir no banco de dados!");
  }

  fecharPopup();
});


