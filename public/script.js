$('#chartModal').on('shown.bs.modal', function () {
    const ctx = document.getElementById('popupChart').getContext('2d');
    console.log("hii");
    new Chart(ctx, {
      type: 'line', // Change chart type as needed
      data: {
        labels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], // X-axis labels
        datasets: [{
          label: 'Attendance',
          data: [12, 19, 3, 5, 2], // Data points
          backgroundColor: [
            'rgba(75, 192, 192, 0.2)',
            'rgba(153, 102, 255, 0.2)',
            'rgba(255, 159, 64, 0.2)',
            'rgba(255, 99, 132, 0.2)',
            'rgba(54, 162, 235, 0.2)'
          ],
          borderColor: [
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(255, 159, 64, 1)',
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  });

  document.getElementById("marks-form").addEventListener("submit", async function(event) {
    event.preventDefault();

    
    try {
      const semester = document.getElementById("semester").value;
      console.log(semester);
        const response = await fetch("/marks", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ semester })
        });

        if (!response.ok) {
            throw new Error("Failed to fetch marks data.");
        }

        const data = await response.json(); 
        document.getElementById("cgpaText").textContent = data.cgpa;
        document.getElementById("sgpa").textContent = data.sgpa;
        const marksTableBody = document.querySelector("#marks-table tbody");
        marksTableBody.innerHTML = "";
        data.marks.forEach(mark => {
            const row = document.createElement("tr");
            row.innerHTML = `<td>${mark.subject}</td><td>${mark.marks}</td>`;
            marksTableBody.appendChild(row);
        });
    } catch (error) {
        console.error("Error fetching marks:", error.message);
    }
});