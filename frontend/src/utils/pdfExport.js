import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const WEEK_DAYS = [
  { key: "lunes", label: "Lunes" },
  { key: "martes", label: "Martes" },
  { key: "miercoles", label: "Miércoles" },
  { key: "jueves", label: "Jueves" },
  { key: "viernes", label: "Viernes" },
  { key: "sabado", label: "Sábado" },
  { key: "domingo", label: "Domingo" },
];

function normalizeDayKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function getPlanMealsForDay(planData, dayKey) {
  return (planData?.meals || [])
    .filter((meal) => normalizeDayKey(meal.dia) === dayKey)
    .sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
}

export async function exportPlanToPDF(planData, userName, weekStart) {
  try {
    // Create a temporary container for the PDF content
    const tempContainer = document.createElement("div");
    tempContainer.style.position = "absolute";
    tempContainer.style.left = "-9999px";
    tempContainer.style.background = "white";
    tempContainer.style.padding = "20px";
    tempContainer.style.width = "800px";
    tempContainer.style.fontFamily = "Arial, sans-serif";
    tempContainer.style.fontSize = "11px";

    const startDate = new Date(`${weekStart}T00:00:00`);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    const formatDate = (date) => {
      return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    // HTML for the PDF
    let html = `
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="margin: 0; color: #14532d; font-size: 24px;">Plan de Comidas Semanal</h1>
        <p style="margin: 5px 0; color: #475569; font-size: 12px;">${userName}</p>
        <p style="margin: 5px 0; color: #64748b; font-size: 11px;">
          Semana del ${formatDate(startDate)} al ${formatDate(endDate)}
        </p>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #14532d; color: white;">
            ${WEEK_DAYS.map((day, index) => {
              const date = new Date(startDate);
              date.setDate(date.getDate() + index);
              return `
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">
                  <strong>${day.label}</strong><br/>
                  <span style="font-size: 10px; color: #ddd;">${formatDate(date)}</span>
                </th>
              `;
            }).join("")}
          </tr>
        </thead>
        <tbody>
          <tr>
            ${WEEK_DAYS.map((day) => {
              const sortedMeals = getPlanMealsForDay(planData, day.key);

              let mealHtml = '<div style="padding: 8px;">';

              if (sortedMeals.length === 0) {
                mealHtml += '<p style="margin: 0; color: #94a3b8; font-size: 10px; font-style: italic;">Sin comidas</p>';
              } else {
                sortedMeals.forEach((meal) => {
                  const items = meal.items || [];
                  if (items.length > 0) {
                    mealHtml += `
                      <div style="margin-bottom: 8px; padding: 6px; background: #f8fafc; border-left: 3px solid #166534; border-radius: 3px;">
                        <p style="margin: 0 0 4px; color: #166534; font-weight: bold; font-size: 10px;">${meal.hora}</p>
                    `;
                    items.forEach((item) => {
                      const itemName = item.food?.nombre || item.recipe?.nombre || "Sin nombre";
                      const quantity = item.cantidad || 1;
                      mealHtml += `
                        <p style="margin: 2px 0; color: #0f172a; font-size: 9px;">
                          • ${itemName} ${quantity > 1 ? `(x${quantity})` : ""}
                        </p>
                      `;
                    });
                    mealHtml += '</div>';
                  }
                });
              }

              mealHtml += '</div>';

              return `
                <td style="border: 1px solid #ddd; padding: 0; vertical-align: top; background: #ffffff; height: 200px; overflow-y: auto;">
                  ${mealHtml}
                </td>
              `;
            }).join("")}
          </tr>
        </tbody>
      </table>

      <div style="font-size: 10px; color: #64748b; text-align: center; margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0;">BodyFuel - Plan de Comidas Generado</p>
        <p style="margin: 0;">${new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })}</p>
      </div>
    `;

    tempContainer.innerHTML = html;
    document.body.appendChild(tempContainer);

    // Convert HTML to canvas
    const canvas = await html2canvas(tempContainer, {
      backgroundColor: "#ffffff",
      scale: 2,
    });

    document.body.removeChild(tempContainer);

    // Create PDF
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const imgWidth = 280;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const pageHeight = pdf.internal.pageSize.getHeight();
    const pageWidth = pdf.internal.pageSize.getWidth();

    let heightLeft = imgHeight;
    let position = 0;

    const imgData = canvas.toDataURL("image/png");

    while (heightLeft > 0) {
      pdf.addImage(imgData, "PNG", (pageWidth - imgWidth) / 2, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      position -= pageHeight;
      if (heightLeft > 0) {
        pdf.addPage();
      }
    }

    // Save the PDF
    pdf.save(`Plan-Semanal-${weekStart}.pdf`);
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw new Error("Error al generar el PDF: " + error.message);
  }
}
