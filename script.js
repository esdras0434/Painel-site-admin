import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Config Firebase
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

const inputBusca = document.getElementById("buscaFuncionario");
const sugestoesBox = document.getElementById("sugestoes");
let funcionarios = [];

// Função para formatar data yyyy-mm-dd -> dd/mm/yyyy
function formatarData(dataStr) {
  const partes = dataStr.split("-");
  if (partes.length !== 3) return dataStr; // fallback
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

// Carrega funcionários da coleção 'funcionarios'
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

// Evento para autocomplete
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

// Buscar pontos da coleção 'pontos' filtrando pelo CPF e data/mês
async function buscarPontos() {
  const cpfTexto = inputBusca.value.match(/\(([^)]+)\)$/);
  const cpf = cpfTexto ? cpfTexto[1] : inputBusca.value.trim();

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
    const funcionarioNome = funcionarios.find(f => f.cpf === cpf)?.nome || "Funcionário";
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
            <td>${celula("entrada_manha")}</td>
            <td>${celula("saida_almoco")}</td>
            <td>${celula("retorno_almoco")}</td>
            <td>${celula("saida_tarde")}</td>
          </tr>
        `;
      });
  } catch (e) {
    console.error("Erro buscando pontos:", e);
  }
}
window.buscarPontos = buscarPontos;

// Função para exportar tabela para PDF (sem imagens)
window.exportarPDF = function () {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const nomeFuncionario = document.getElementById("nomeFuncionario").textContent || "Funcionário";

  doc.setFontSize(16);
  doc.text(nomeFuncionario, 14, 20);

  const headers = [];
  document.querySelectorAll("#tabelaPontos thead tr:nth-child(2) th").forEach(th => {
    headers.push(th.textContent);
  });

  const data = [];
  document.querySelectorAll("#tabelaPontos tbody tr").forEach(tr => {
    const row = [];
    tr.querySelectorAll("td").forEach(td => {
      row.push(td.textContent);
    });
    data.push(row);
  });

  doc.autoTable({
    head: [headers],
    body: data,
    startY: 30,
    theme: 'striped',
  });

  doc.save(`pontos_${nomeFuncionario.replace(/\s+/g, "_")}.pdf`);
};
