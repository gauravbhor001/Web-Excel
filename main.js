let allData = [];
let headers = [];
let selectedParts = [];

document.addEventListener("DOMContentLoaded", async () => {
  const response = await fetch("smc_products.csv");
  const csvText = await response.text();
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  allData = parsed.data;
  headers = parsed.meta.fields;
  renderTable([], "search-data-container"); // Show empty initially

  const searchInput = document.getElementById("search-input");
  const suggestionList = document.getElementById("suggestion-list");

  // Show suggestions as you type
  searchInput.addEventListener("input", function () {
    const value = this.value.trim().toLowerCase();
    if (!value) {
      suggestionList.style.display = "none";
      suggestionList.innerHTML = "";
      return;
    }
    // Find unique matching Part No (case-insensitive), excluding already selected
    const matches = allData
      .filter(row => row["Part No"] && row["Part No"].toLowerCase().includes(value))
      .map(row => row["Part No"])
      .filter((v, i, arr) => arr.indexOf(v) === i && !selectedParts.includes(v))
      .slice(0, 10);

    if (matches.length) {
      suggestionList.innerHTML = matches.map(partNo => `<li style="list-style:none; padding:4px; cursor:pointer;">${partNo}</li>`).join("");
      suggestionList.style.display = "block";
    } else {
      suggestionList.style.display = "none";
      suggestionList.innerHTML = "";
    }
  });

  // Add selected suggestion to the list
  suggestionList.addEventListener("click", function (e) {
    if (e.target.tagName === "LI") {
      const partNo = e.target.textContent;
      if (!selectedParts.includes(partNo)) {
        selectedParts.push(partNo);
        updateSelectedPartsUI();
        renderSelectedTable();
      }
      searchInput.value = "";
      suggestionList.style.display = "none";
      suggestionList.innerHTML = "";
    }
  });

  // Remove part from selected list (optional)
  document.getElementById("selected-parts").addEventListener("click", function(e) {
    if (e.target.classList.contains("remove-part")) {
      const partNo = e.target.dataset.part;
      selectedParts = selectedParts.filter(p => p !== partNo);
      updateSelectedPartsUI();
      renderSelectedTable();
    }
  });

  // On form submit, show all selected parts
  document.getElementById("search-form").addEventListener("submit", function (e) {
    e.preventDefault();
    renderSelectedTable();
  });

  function updateSelectedPartsUI() {
    const container = document.getElementById("selected-parts");
    container.innerHTML = selectedParts.map(part => 
      `<span style="display:inline-block; margin:2px; padding:2px 6px; background:#e0e0e0; border-radius:4px;">
        ${part} <button type="button" class="remove-part" data-part="${part}" style="border:none;background:none;cursor:pointer;">&times;</button>
      </span>`
    ).join("");
  }

  function renderSelectedTable() {
    if (selectedParts.length === 0) {
      renderTable([], "search-data-container");
      return;
    }
    const filtered = allData.filter(row => selectedParts.includes(row["Part No"]));
    renderTable(filtered, "search-data-container");
  }
});

function renderTable(data, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  if (!data.length) {
    container.innerHTML = "<p class='text-muted text-center'>No data found.</p>";
    return;
  }
  const tableHtml = `<div class="table-responsive">
    <table class="table table-bordered table-hover table-striped align-middle shadow-sm mb-0">
      <thead class="table-primary">
        <tr>
          ${Object.keys(data[0])
            .map((h) => `<th scope="col" class="text-center">${h}</th>`)
            .join("")}
        </tr>
      </thead>
      <tbody>
        ${data
          .map(
            (row) =>
              `<tr>
                ${Object.keys(row)
                  .map((h) => {
                    const val = row[h];
                    const isNum = val !== "" && !isNaN(val);
                    let displayVal = val;
                    if (isNum && typeof val === "string" && val.includes('.')) {
                      displayVal = parseFloat(val).toFixed(2);
                    }
                    return `<td class="${isNum ? "text-end" : ""}">${displayVal}</td>`;
                  })
                  .join("")}
              </tr>`
          )
          .join("")}
      </tbody>
    </table>
  </div>`;
  container.innerHTML = tableHtml;

  // Add the "Add Quantities" button after the table if there are results
  if (data.length) {
    let btn = document.createElement("button");
    btn.id = "open-popup-btn";
    btn.textContent = "Checkout";
    btn.className = "btn btn-success mt-3 w-100 w-md-auto";
    btn.onclick = function() {
      openPopupWithData(data);
    };
    container.appendChild(btn);
  }
}

function openPopupWithData(data) {
  const overlay = document.getElementById("popup-overlay");
  const tableContainer = document.getElementById("popup-table-container");
  const popupColumns = ["Part No", "SMC LP", "CUBIX LP"]; // Update as needed

  // Build table with quantity input (default 1) and price for each row
  tableContainer.innerHTML = `<div class="table-responsive">
    <table class="table table-bordered table-sm align-middle mb-0">
      <thead>
        <tr>
          ${popupColumns.map(h => `<th>${h}</th>`).join("")}
          <th>Quantity</th>
          <th>Final Price</th>
        </tr>
      </thead>
      <tbody>
        ${data.map((row, idx) => {
          const cubix = parseFloat(row["CUBIX LP"]) || 0;
          const defaultQty = 1;
          const defaultPrice = (defaultQty * cubix).toFixed(2);
          return `
          <tr>
            ${popupColumns.map(h => `<td>${row[h] ?? ""}</td>`).join("")}
            <td>
              <input type="number" min="0" name="qty-${idx}" value="1" class="form-control form-control-sm qty-input" data-idx="${idx}" style="width:80px;max-width:100%;" />
            </td>
            <td id="price-${idx}">${defaultPrice}</td>
          </tr>
        `;
        }).join("")}
      </tbody>
    </table>
  </div>`;
  overlay.style.display = "block";

  // Update price live as quantity changes
  tableContainer.querySelectorAll('.qty-input').forEach(input => {
    input.addEventListener('input', function() {
      const idx = this.dataset.idx;
      const qty = parseFloat(this.value) || 0;
      const cubix = parseFloat(data[idx]["CUBIX LP"]) || 0;
      document.getElementById(`price-${idx}`).textContent = (qty * cubix).toFixed(2);
    });
  });

  // Save quantities and prices
  document.getElementById("quantity-form").onsubmit = function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    const quantities = data.map((row, idx) => {
      const qty = parseFloat(formData.get(`qty-${idx}`)) || 0;
      const cubix = parseFloat(row["CUBIX LP"]) || 0;
      return {
        ...row,
        Quantity: qty,
        Price: +(qty * cubix).toFixed(2)
      };
    });

    // Ask for file name
    let fileName = prompt("Enter file name for download (without extension):", "quantities");
    if (!fileName) fileName = "quantities";
    fileName = fileName.replace(/[^a-zA-Z0-9_\-]/g, "_") + ".csv";

    // Convert to CSV
    const csvHeaders = ['Part No', 'CUBIX LP', 'Quantity','Price'];
    const csvRows = [
      csvHeaders.join(","),
      ...quantities.map(row => csvHeaders.map(h => `"${(row[h] ?? "").toString().replace(/"/g, '""')}"`).join(","))
    ];
    const csvContent = csvRows.join("\r\n");
    
    // Download as Excel-compatible CSV
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Close popup
    overlay.style.display = "none";
  };
}
// Close popup logic
document.getElementById("close-popup").onclick = function() {
  document.getElementById("popup-overlay").style.display = "none";
};