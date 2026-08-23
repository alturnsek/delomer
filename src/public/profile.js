const ctx = document.getElementById('hoursChart');

new Chart(ctx, {
    type: 'line',
    data: {
        labels: [
            'Jan',
            'Feb',
            'Mar',
            'Apr',
            'Maj',
            'Jun'
        ],
        datasets: [{
            label: 'Opravljene ure',
            data: [25, 40, 18, 55, 31, 44],
            borderColor: '#2563eb',
            tension: 0.3
        }]
    }
});