async function carregarClientes() {
    const response = await fetch("https://sistema-advocacia.onrender.com/clientes"); // Endpoint do backend
    const data = await response.json();

    const tabela = document.getElementById("clientes-tabela");
    tabela.innerHTML = ""; // Limpa a tabela antes de preencher

    data.forEach((cliente) => {
        const linha = document.createElement("tr");
        linha.innerHTML = `
            <td>${cliente.id}</td>
            <td>${cliente.nome}</td>
            <td><a href="${cliente.link}" target="_blank">Baixar PDF</a></td>
        `;
        tabela.appendChild(linha);
    });
}

// Chamar a função ao carregar a página
carregarClientes();
