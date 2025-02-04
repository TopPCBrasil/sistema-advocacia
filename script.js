document.getElementById("cadastro-form").addEventListener("submit", async (event) => {
    event.preventDefault(); // Evita o recarregamento da página

    let nome = document.getElementById("nome").value;
    let pdfFile = document.getElementById("pdf").files[0];

    if (!nome || !pdfFile) {
        alert("Preencha todos os campos!");
        return;
    }

    let formData = new FormData();
    formData.append("nome", nome);
    formData.append("pdf", pdfFile);

    let response = await fetch("https://sistema-advocacia.onrender.com/cadastrar", {
        method: "POST",
        body: formData,
    });

    let result = await response.json();
    alert(result.message);
});
