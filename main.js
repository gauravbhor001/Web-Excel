let allData = [];
let headers = [];
let selectedParts = [];
let selectedProductData = {}; // Tracks quantity and price per part

document.addEventListener("DOMContentLoaded", async () => {
  const response = await fetch("smc_products.csv");
  const csvText = await response.text();
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

  // Remove duplicates based on "Part No"
  const seen = new Set();
  allData = parsed.data.filter(row => {
    const partNo = row["Part No"];
    if (seen.has(partNo)) return false;
    seen.add(partNo);
    return true;
  });

  headers = parsed.meta.fields;
  renderTable([], "search-data-container");

  const searchInput = document.getElementById("search-input");
  const suggestionList = document.getElementById("suggestion-list");

  // 🔍 Suggestions
  searchInput.addEventListener("input", function () {
    const value = this.value.trim().toLowerCase();
    if (!value) {
      suggestionList.style.display = "none";
      suggestionList.innerHTML = "";
      return;
    }

    const matches = allData
      .filter(row => {
        const partNo = row["Part No"];
        return (
          partNo &&
          partNo.toLowerCase().startsWith(value) &&
          !selectedParts.includes(partNo)
        );
      })
      .map(row => row["Part No"])
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .slice(0, 10);

    if (matches.length) {
      suggestionList.innerHTML = matches
        .map(partNo => `<li style="list-style:none; padding:4px; cursor:pointer;">${partNo}</li>`)
        .join("");
      suggestionList.style.display = "block";
    } else {
      suggestionList.style.display = "none";
      suggestionList.innerHTML = "";
    }
  });

  // 🔄 Select a suggestion
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

  // ❌ Remove item
  document.getElementById("selected-parts").addEventListener("click", function (e) {
    if (e.target.classList.contains("remove-part")) {
      const partNo = e.target.dataset.part;
      selectedParts = selectedParts.filter(p => p !== partNo);
      delete selectedProductData[partNo];
      updateSelectedPartsUI();
      renderSelectedTable();
    }
  });

  // Manual form submit (optional)
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

    const filtered = allData
      .filter(row => selectedParts.includes(row["Part No"]));

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

  const originalHeaders = Object.keys(data[0]);
  const allHeaders = [...originalHeaders, "Quantity", "Final Price"];

  const tableHtml = `<div class="table-responsive">
    <table class="table table-bordered table-hover table-striped align-middle shadow-sm mb-0">
      <thead class="table-primary">
        <tr>
          ${allHeaders.map(h => `<th scope="col" class="text-center">${h}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${data.map((row, index) => {
          const partNo = row["Part No"];
          const saved = selectedProductData[partNo] || {};
          const quantity = saved.Quantity || 1;
          const cubixLP = parseFloat(row["CUBIX LP"]) || 0;
          const finalPrice = (cubixLP * quantity).toFixed(2);

          const rowHtml = originalHeaders.map(h => {
            const val = row[h];
            const isNum = val !== "" && !isNaN(val);
            let displayVal = val;
            if (isNum && typeof val === "string" && val.includes('.')) {
              displayVal = parseFloat(val).toFixed(2);
            }
            return `<td class="${isNum ? "text-end" : ""}">${displayVal}</td>`;
          }).join("");

          return `<tr data-index="${index}">
            ${rowHtml}
            <td class="text-end">
              <input type="number" min="0" step="1" value="${quantity}" 
                     class="form-control text-end quantity-input" 
                     data-index="${index}" data-part="${partNo}" data-cubix="${cubixLP}" />
            </td>
            <td class="text-end final-price" id="final-${index}">${finalPrice}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  </div>`;

  container.innerHTML = tableHtml;

  // Event listeners for quantity updates
  document.querySelectorAll(".quantity-input").forEach((input) => {
    input.addEventListener("input", (e) => {
      const index = e.target.dataset.index;
      const partNo = e.target.dataset.part;
      const quantity = parseFloat(e.target.value) || 0;
      const cubixLP = parseFloat(e.target.dataset.cubix) || 0;
      const final = (cubixLP * quantity).toFixed(2);

      document.getElementById(`final-${index}`).textContent = final;

      selectedProductData[partNo] = {
        Quantity: quantity,
        Price: parseFloat(final)
      };
    });
  });

  // Add Checkout Button
  if (data.length) {
    const btn = document.createElement("button");
    btn.id = "open-popup-btn";
    btn.textContent = "Checkout";
    btn.className = "btn btn-success mt-3 w-100 w-md-auto";
    btn.onclick = function () {
      const updatedData = data.map(row => {
        const partNo = row["Part No"];
        return {
          ...row,
          Quantity: selectedProductData[partNo]?.Quantity || 1,
          Price: selectedProductData[partNo]?.Price || (parseFloat(row["CUBIX LP"]) || 0)
        };
      });
      openPopupWithData(updatedData);
    };
    container.appendChild(btn);
  }
}

// 📦 Popup
function openPopupWithData(data) {
  const overlay = document.getElementById("popup-overlay");
  const tableContainer = document.getElementById("popup-table-container");
  const popupColumns = ["Part No", "CUBIX LP", "Quantity", "Price"];

  const totalPrice = data.reduce((sum, row) => sum + (parseFloat(row.Price) || 0), 0);

  tableContainer.innerHTML = `<div class="table-responsive">
    <table class="table table-bordered table-sm align-middle mb-0">
      <thead><tr>${popupColumns.map(h => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>
        ${data.map(row => `
          <tr>
            ${popupColumns.map(h => `<td>${row[h] ?? ""}</td>`).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
    <div class="mt-3">
      <p><strong>Total Price:</strong> ₹ ${totalPrice.toFixed(2)}</p>
      <label for="discount-input"><strong>Discount (%):</strong></label>
      <input type="number" id="discount-input" class="form-control w-auto d-inline-block ms-2" value="0" min="0" max="100" step="1" />
      <p id="discounted-total" class="mt-2"><strong>Final Total:</strong> ₹ ${totalPrice.toFixed(2)}</p>
    </div>
  </div>`;

  overlay.style.display = "block";

  const discountInput = document.getElementById("discount-input");
  const discountedTotal = document.getElementById("discounted-total");

  discountInput.addEventListener("input", function () {
    const discountPercent = parseFloat(this.value) || 0;
    const final = totalPrice * (1 - discountPercent / 100);
    discountedTotal.innerHTML = `<strong>Final Total:</strong> ₹ ${final.toFixed(2)}`;
  });

  // Export CSV
  document.getElementById("quantity-form").onsubmit = function (e) {
    e.preventDefault();

    let fileName = prompt("Enter file name for download (without extension):", "quantities");
    if (!fileName) fileName = "quantities";
    fileName = fileName.replace(/[^a-zA-Z0-9_\-]/g, "_") + ".csv";

    const csvHeaders = ["Part No", "CUBIX LP", "Quantity", "Price"];
    const discountPercent = parseFloat(discountInput.value) || 0;
    const finalPrice = totalPrice * (1 - discountPercent / 100);

    const csvRows = [
      csvHeaders.join(","),
      ...data.map(row =>
        csvHeaders.map(h => `"${(row[h] ?? "").toString().replace(/"/g, '""')}"`).join(",")
      ),
      `,,Total,"${totalPrice.toFixed(2)}"`,
      `,,Discount %,"${discountPercent.toFixed(2)}"`,
      `,,Final Total,"${finalPrice.toFixed(2)}"`
    ];

    const csvContent = csvRows.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    overlay.style.display = "none";
  };
}

// ❌ Close Popup
document.getElementById("close-popup").onclick = function () {
  document.getElementById("popup-overlay").style.display = "none";
};
