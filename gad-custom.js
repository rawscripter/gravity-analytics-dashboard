jQuery(document).ready(function($) {
    let chartInstance;
    let fieldChartInstance;
    let currentFormData = null;
    let currentChartType = 'area';
    // Add pagination variables to the global scope
    let currentPage = 1;
    let totalPages = 1;
    const itemsPerPage = 10;

    // Initialize date range picker
    $('#gad-date-range').daterangepicker({
        opens: 'left',
        autoApply: true,
        maxDate: new Date(),
        startDate: moment().subtract(7, 'days'),
        endDate: moment(),
        locale: {
            format: 'YYYY-MM-DD'
        }
    }, function(start, end) {
        // Update hidden date inputs when date range changes
        $('#gad-start-date').val(start.format('YYYY-MM-DD'));
        $('#gad-end-date').val(end.format('YYYY-MM-DD'));
    });

    // Set initial values for hidden date inputs
    const dateRange = $('#gad-date-range').data('daterangepicker');
    $('#gad-start-date').val(dateRange.startDate.format('YYYY-MM-DD'));
    $('#gad-end-date').val(dateRange.endDate.format('YYYY-MM-DD'));

    // Tab navigation
    $('.gad-tab-btn').on('click', function() {
        // Update active states
        $('.gad-tab-btn').removeClass('active');
        $(this).addClass('active');
        
        // Show corresponding tab content
        const tabId = $(this).data('tab');
        $('.gad-tab-content').removeClass('active');
        $(`#gad-tab-${tabId}`).addClass('active');
        
        // If switching to field analysis tab and we haven't loaded the data yet
        if (tabId === 'fields' && !fieldChartInstance && currentFormData) {
            loadFieldStats();
        }
        
        // If switching to reports tab, load any existing scheduled reports
        if (tabId === 'reports' && currentFormData) {
            loadScheduledReports();
        }
        
        // If switching to submissions tab, load detailed submission data
        if (tabId === 'submissions' && currentFormData) {
            loadSubmissionData();
        }
    });

    // Chart type selector buttons
    $('.gad-chart-type-btn').on('click', function() {
        // Update active state
        $('.gad-chart-type-btn').removeClass('active');
        $(this).addClass('active');
        
        // Get chart type and update chart
        currentChartType = $(this).data('type');
        if (currentFormData) {
            renderChart(currentFormData);
        }
    });

    $('#gad-filter-form').on('submit', function(e) {
        e.preventDefault();

        const formID    = $('#gad-form-select').val();
        const startDate = $('#gad-start-date').val();
        const endDate   = $('#gad-end-date').val();

        if (!formID || !startDate || !endDate) {
            alert('Please select a form and specify a date range.');
            return;
        }

        // Show loading state, hide previous results
        $('#gad-loading').css('display', 'flex');
        $('#gad-results-container, #gad-no-data').hide();

        $.ajax({
            url: gad_ajax.ajax_url,
            method: 'POST',
            data: {
                action: 'get_form_data',
                security: gad_ajax.nonce,
                form_id: formID,
                start_date: startDate,
                end_date: endDate
            },
            dataType: 'json',
            success: function(response) {
                // Hide loading state
                $('#gad-loading').hide();
                
                if (response.success) {
                    if (Object.keys(response.data.daily_stats).length > 0) {
                        currentFormData = response.data;
                        renderChart(response.data);
                        renderSummaryAndTable(response);
                        
                        // Reset field chart if exists
                        if (fieldChartInstance) {
                            fieldChartInstance.destroy();
                            fieldChartInstance = null;
                        }
                        
                        // If field analysis tab is active, load field stats
                        if ($('#gad-tab-fields').hasClass('active')) {
                            loadFieldStats();
                        }
                        
                        // If reports tab is active, load scheduled reports
                        if ($('#gad-tab-reports').hasClass('active')) {
                            loadScheduledReports();
                        }
                        
                        $('#gad-results-container').show();
                    } else {
                        $('#gad-no-data').show();
                    }
                } else {
                    alert('Error: ' + response.data);
                }
            },
            error: function() {
                $('#gad-loading').hide();
                alert('An error occurred while retrieving data.');
            }
        });
    });
    
    // Schedule reports form submission
    $('#gad-schedule-form').on('submit', function(e) {
        e.preventDefault();
        
        const formID = $('#gad-form-select').val();
        const email = $('#gad-report-email').val();
        const frequency = $('input[name="gad-frequency"]:checked').val();
        
        // Get selected format options
        const formatOptions = [];
        $('input[name="gad-format[]"]:checked').each(function() {
            formatOptions.push($(this).val());
        });
        
        if (!formID || !email || !frequency || formatOptions.length === 0) {
            alert('Please fill in all required fields and select at least one report format option.');
            return;
        }
        
        // Show loading in button
        const submitBtn = $(this).find('button[type="submit"]');
        const originalBtnText = submitBtn.html();
        submitBtn.html('<i class="fas fa-spinner fa-spin"></i> Scheduling...');
        submitBtn.prop('disabled', true);
        
        $.ajax({
            url: gad_ajax.ajax_url,
            method: 'POST',
            data: {
                action: 'gad_schedule_report',
                security: gad_ajax.nonce,
                form_id: formID,
                email: email,
                frequency: frequency,
                format: formatOptions
            },
            dataType: 'json',
            success: function(response) {
                // Reset button
                submitBtn.html(originalBtnText);
                submitBtn.prop('disabled', false);
                
                if (response.success) {
                    // Show success message
                    $('#gad-schedule-status').fadeIn();
                    
                    // Clear form
                    $('#gad-report-email').val('');
                    
                    // Reload scheduled reports
                    loadScheduledReports();
                    
                    // Hide success message after a delay
                    setTimeout(function() {
                        $('#gad-schedule-status').fadeOut();
                    }, 5000);
                } else {
                    alert('Error: ' + response.data);
                }
            },
            error: function() {
                submitBtn.html(originalBtnText);
                submitBtn.prop('disabled', false);
                alert('An error occurred while scheduling the report.');
            }
        });
    });
    
    // Send test report button
    $('#gad-send-test').on('click', function() {
        const formID = $('#gad-form-select').val();
        const email = $('#gad-report-email').val();
        const startDate = $('#gad-start-date').val();
        const endDate = $('#gad-end-date').val();
        
        // Get selected format options
        const formatOptions = [];
        $('input[name="gad-format[]"]:checked').each(function() {
            formatOptions.push($(this).val());
        });
        
        if (!formID || !email || formatOptions.length === 0) {
            alert('Please fill in email address and select at least one report format option.');
            return;
        }
        
        // Show loading in button
        const btn = $(this);
        const originalBtnText = btn.html();
        btn.html('<i class="fas fa-spinner fa-spin"></i> Sending...');
        btn.prop('disabled', true);
        
        $.ajax({
            url: gad_ajax.ajax_url,
            method: 'POST',
            data: {
                action: 'gad_send_test_report',
                security: gad_ajax.nonce,
                form_id: formID,
                email: email,
                format: formatOptions,
                start_date: startDate,
                end_date: endDate
            },
            dataType: 'json',
            success: function(response) {
                // Reset button
                btn.html(originalBtnText);
                btn.prop('disabled', false);
                
                if (response.success) {
                    alert('Test report sent successfully!');
                } else {
                    alert('Error: ' + response.data);
                }
            },
            error: function() {
                btn.html(originalBtnText);
                btn.prop('disabled', false);
                alert('An error occurred while sending the test report.');
            }
        });
    });
    
    // Function to load scheduled reports
    function loadScheduledReports() {
        const formID = $('#gad-form-select').val();
        
        // Show loading indicator
        $('#gad-reports-table-container').html('<div class="gad-loading" style="display:flex;"><div class="gad-loading-spinner"></div><span>Loading scheduled reports...</span></div>');
        
        $.ajax({
            url: gad_ajax.ajax_url,
            method: 'POST',
            data: {
                action: 'gad_get_scheduled_reports',
                security: gad_ajax.nonce,
                form_id: formID
            },
            dataType: 'json',
            success: function(response) {
                if (response.success && Array.isArray(response.data) && response.data.length > 0) {
                    renderScheduledReports(response.data);
                } else {
                    // No scheduled reports
                    $('#gad-reports-table-container').html('<p class="gad-no-reports-message">No reports are currently scheduled for this form.</p>');
                }
            },
            error: function() {
                $('#gad-reports-table-container').html('<p>Error loading scheduled reports.</p>');
            }
        });
    }
    
    // Function to render scheduled reports table
    function renderScheduledReports(reports) {
        // Create table HTML
        let tableHtml = '<table class="widefat">';
        tableHtml += '<thead><tr><th>Recipients</th><th>Frequency</th><th>Next Send Date</th><th>Report Format</th><th>Actions</th></tr></thead>';
        tableHtml += '<tbody>';
        
        reports.forEach(report => {
            // Format emails
            const emails = report.emails.join(', ');
            
            // Format frequency
            let frequency = 'Weekly';
            if (report.frequency === 'monthly') frequency = 'Monthly';
            if (report.frequency === 'quarterly') frequency = 'Quarterly';
            
            // Format next send date
            const nextSend = new Date(report.next_send).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            
            // Format report format
            const format = report.format.map(f => {
                switch(f) {
                    case 'chart': return 'Chart';
                    case 'summary': return 'Summary';
                    case 'table': return 'Table';
                    case 'fields': return 'Field Analysis';
                    default: return f;
                }
            }).join(', ');
            
            tableHtml += `
                <tr data-report-id="${report.id}">
                    <td>${emails}</td>
                    <td>${frequency}</td>
                    <td>${nextSend}</td>
                    <td>${format}</td>
                    <td>
                        <button type="button" class="gad-delete-report button button-small">
                            <i class="fas fa-trash-alt"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tableHtml += '</tbody></table>';
        
        // Insert table
        $('#gad-reports-table-container').html(tableHtml);
        
        // Add event listener for delete buttons
        $('.gad-delete-report').on('click', function() {
            const row = $(this).closest('tr');
            const reportId = row.data('report-id');
            
            if (confirm('Are you sure you want to delete this scheduled report?')) {
                $.ajax({
                    url: gad_ajax.ajax_url,
                    method: 'POST',
                    data: {
                        action: 'gad_delete_scheduled_report',
                        security: gad_ajax.nonce,
                        report_id: reportId
                    },
                    dataType: 'json',
                    success: function(response) {
                        if (response.success) {
                            // Remove the row
                            row.fadeOut(300, function() {
                                $(this).remove();
                                
                                // If no more rows, show "no reports" message
                                if ($('#gad-reports-table-container table tbody tr').length === 0) {
                                    $('#gad-reports-table-container').html('<p class="gad-no-reports-message">No reports are currently scheduled for this form.</p>');
                                }
                            });
                        } else {
                            alert('Error: ' + response.data);
                        }
                    },
                    error: function() {
                        alert('An error occurred while deleting the scheduled report.');
                    }
                });
            }
        });
    }
    
    // Function to load field statistics
    function loadFieldStats() {
        const formID = $('#gad-form-select').val();
        const startDate = $('#gad-start-date').val();
        const endDate = $('#gad-end-date').val();
        
        // Show loading in the field stats area
        $('#gad-field-completion-chart-container').html('<div class="gad-loading" style="display:flex;"><div class="gad-loading-spinner"></div><span>Loading field stats...</span></div>');
        $('#gad-field-stats-table').empty();
        
        $.ajax({
            url: gad_ajax.ajax_url,
            method: 'POST',
            data: {
                action: 'get_field_stats',
                security: gad_ajax.nonce,
                form_id: formID,
                start_date: startDate,
                end_date: endDate
            },
            dataType: 'json',
            success: function(response) {
                if (response.success && Array.isArray(response.data) && response.data.length > 0) {
                    renderFieldStats(response.data);
                } else {
                    $('#gad-field-completion-chart-container').html('<p>No field data available.</p>');
                }
            },
            error: function() {
                $('#gad-field-completion-chart-container').html('<p>Error loading field statistics.</p>');
            }
        });
    }
    
    // Function to render field statistics
    function renderFieldStats(fieldStats) {
        // Prepare chart data
        const labels = fieldStats.map(field => field.label);
        const data = fieldStats.map(field => field.completion_rate);
        
        // Create chart container
        $('#gad-field-completion-chart-container').html('<canvas id="gad-field-completion-chart"></canvas>');
        const ctx = document.getElementById('gad-field-completion-chart').getContext('2d');
        
        // Define colors for bars
        const colors = fieldStats.map(field => {
            const rate = field.completion_rate;
            if (rate >= 90) return '#34a853'; // Green for high completion rates
            if (rate >= 70) return '#4285f4'; // Blue for good completion rates
            if (rate >= 50) return '#fbbc05'; // Yellow for medium completion rates
            return '#ea4335'; // Red for low completion rates
        });
        
        // Create the chart
        fieldChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Completion Rate (%)',
                    data: data,
                    backgroundColor: colors,
                    borderColor: colors,
                    borderWidth: 1,
                    borderRadius: 4,
                    barPercentage: 0.7,
                    maxBarThickness: 35
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Completion Rate (%)',
                            font: {
                                weight: 'bold'
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const field = fieldStats[context.dataIndex];
                                return [
                                    `Completion Rate: ${field.completion_rate}%`,
                                    `Filled: ${field.filled_count} / ${field.total_entries}`
                                ];
                            }
                        }
                    }
                }
            }
        });
        
        // Create the table
        let tableHtml = '<table class="widefat">';
        tableHtml += '<thead><tr><th>Field</th><th>Completion Rate</th><th>Filled / Total</th></tr></thead>';
        tableHtml += '<tbody>';
        
        fieldStats.forEach(field => {
            let rateClass = '';
            if (field.completion_rate >= 90) rateClass = 'high-rate';
            else if (field.completion_rate >= 70) rateClass = 'good-rate';
            else if (field.completion_rate >= 50) rateClass = 'medium-rate';
            else rateClass = 'low-rate';
            
            tableHtml += `
                <tr>
                    <td>${field.label}</td>
                    <td>
                        <div class="gad-completion-bar-container">
                            <div class="gad-completion-bar ${rateClass}" style="width: ${field.completion_rate}%"></div>
                            <span>${field.completion_rate}%</span>
                        </div>
                    </td>
                    <td>${field.filled_count} / ${field.total_entries}</td>
                </tr>
            `;
        });
        
        tableHtml += '</tbody></table>';
        
        // Apply table styles
        const tableStyles = `
            <style>
                .gad-completion-bar-container {
                    width: 100%;
                    background-color: #f0f0f1;
                    border-radius: 4px;
                    height: 20px;
                    position: relative;
                    overflow: hidden;
                }
                .gad-completion-bar {
                    height: 100%;
                    position: absolute;
                    left: 0;
                    top: 0;
                }
                .gad-completion-bar.high-rate { background-color: #34a853; }
                .gad-completion-bar.good-rate { background-color: #4285f4; }
                .gad-completion-bar.medium-rate { background-color: #fbbc05; }
                .gad-completion-bar.low-rate { background-color: #ea4335; }
                .gad-completion-bar-container span {
                    position: absolute;
                    left: 50%;
                    top: 50%;
                    transform: translate(-50%, -50%);
                    color: #000;
                    font-weight: bold;
                    font-size: 12px;
                    text-shadow: 0 0 3px rgba(255,255,255,0.8);
                }
            </style>
        `;
        
        $('#gad-field-stats-table').html(tableStyles + tableHtml);
    }

    // Export to CSV functionality
    $('#gad-export-csv').on('click', function() {
        if (!currentFormData) return;
        
        // Convert data to CSV format
        let csvContent = "Date,Submissions\n";
        Object.entries(currentFormData).forEach(([date, count]) => {
            csvContent += `${date},${count}\n`;
        });
        
        // Create and trigger download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        
        // Get form name for filename
        const formName = $('#gad-form-select option:selected').text().replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const startDate = $('#gad-start-date').val();
        const endDate = $('#gad-end-date').val();
        
        link.setAttribute("download", `gravity_analytics_${formName}_${startDate}_to_${endDate}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
    
    // Print chart functionality
    $('#gad-print-chart').on('click', function() {
        if (!chartInstance) return;
        
        const dataUrl = chartInstance.toBase64Image();
        
        // Create a printable window
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Gravity Analytics - Print Chart</title>
                    <style>
                        body { font-family: sans-serif; padding: 20px; }
                        .chart-container { margin: 20px auto; max-width: 800px; }
                        .header { text-align: center; margin-bottom: 20px; }
                        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #777; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Form Submissions: ${$('#gad-form-select option:selected').text()}</h1>
                        <p>Period: ${$('#gad-date-range').val()}</p>
                    </div>
                    <div class="chart-container">
                        <img src="${dataUrl}" style="width: 100%;">
                    </div>
                    <div class="footer">
                        <p>Generated on ${new Date().toLocaleDateString()} by Gravity Analytics Dashboard</p>
                    </div>
                    <script>
                        window.onload = function() { window.print(); }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    });
    
    // Export to PDF functionality (uses window.print but with more complete document)
    $('#gad-export-pdf').on('click', function() {
        if (!chartInstance || !currentFormData) return;
        
        const formName = $('#gad-form-select option:selected').text();
        const dateRange = $('#gad-date-range').val();
        const dataUrl = chartInstance.toBase64Image();
        
        // Build table HTML
        let tableHTML = '<table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse;">';
        tableHTML += '<thead><tr><th>Date</th><th>Submissions</th></tr></thead><tbody>';
        
        Object.entries(currentFormData).forEach(([date, count]) => {
            // Format date
            const formattedDate = new Date(date).toLocaleDateString(undefined, { 
                year: 'numeric', month: 'short', day: 'numeric' 
            });
            tableHTML += `<tr><td>${formattedDate}</td><td>${count}</td></tr>`;
        });
        
        tableHTML += '</tbody></table>';
        
        // Get summary stats
        const totalSubmissions = Object.values(currentFormData).reduce((sum, val) => sum + val, 0);
        const avgDaily = (totalSubmissions / Object.keys(currentFormData).length).toFixed(2);
        
        // Create a printable window optimized for PDF saving
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Gravity Analytics Report - ${formName}</title>
                    <style>
                        body { font-family: sans-serif; padding: 20px; }
                        .report-container { max-width: 800px; margin: 0 auto; }
                        .header { text-align: center; margin-bottom: 30px; }
                        .chart-container { margin: 30px 0; }
                        .summary { display: flex; justify-content: space-around; margin: 30px 0; }
                        .summary-box { text-align: center; padding: 15px; border-radius: 5px; background: #f9f9f9; }
                        .summary-box h3 { margin: 0 0 10px 0; color: #555; }
                        .summary-box p { margin: 0; font-size: 24px; font-weight: bold; color: #333; }
                        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                        th { background: #f1f1f1; padding: 10px; text-align: left; }
                        td { padding: 8px 10px; border-bottom: 1px solid #ddd; }
                        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #777; border-top: 1px solid #eee; padding-top: 20px; }
                        @media print {
                            body { padding: 0; }
                            .page-break { page-break-after: always; }
                        }
                    </style>
                </head>
                <body>
                    <div class="report-container">
                        <div class="header">
                            <h1>Gravity Forms Analytics Report</h1>
                            <h2>${formName}</h2>
                            <p>Period: ${dateRange}</p>
                        </div>
                        
                        <div class="summary">
                            <div class="summary-box">
                                <h3>Total Submissions</h3>
                                <p>${totalSubmissions}</p>
                            </div>
                            <div class="summary-box">
                                <h3>Average Daily</h3>
                                <p>${avgDaily}</p>
                            </div>
                        </div>
                        
                        <div class="chart-container">
                            <h3>Submissions Over Time</h3>
                            <img src="${dataUrl}" style="width: 100%;">
                        </div>
                        
                        <div class="page-break"></div>
                        
                        <h3>Detailed Submission Data</h3>
                        ${tableHTML}
                        
                        <div class="footer">
                            <p>Generated on ${new Date().toLocaleDateString()} by Gravity Analytics Dashboard</p>
                        </div>
                    </div>
                    <script>
                        window.onload = function() { window.print(); }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    });

    function renderSummaryAndTable(response) {
        if (!response.data || !response.data.daily_stats) {
            console.error('Invalid response format:', response);
            return;
        }

        // Calculate total submissions and find peak day
        let totalSubmissions = 0;
        let peakDay = null;
        let peakCount = 0;

        Object.entries(response.data.daily_stats).forEach(([date, count]) => {
            totalSubmissions += count;
            if (count > peakCount) {
                peakCount = count;
                peakDay = date;
            }
        });

        const numDays = Object.keys(response.data.daily_stats).length;
        const avgDaily = numDays > 0 ? (totalSubmissions / numDays).toFixed(2) : 0;

        // Update summary stats
        $('#gad-total-submissions').text(totalSubmissions);
        $('#gad-average-daily').text(avgDaily);
        $('#gad-peak-day').text(peakDay ? `${moment(peakDay).format('MMM D, YYYY')} (${peakCount})` : 'N/A');

        // Add styles for both tables
        const tableStyles = `
            <style>
                .gad-table-container {
                    background: #fff;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    margin: 20px 0;
                    padding: 20px;
                }
                .gad-table-container table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                }
                .gad-table-container th {
                    background: #f8f9fa;
                    padding: 12px;
                    text-align: left;
                    font-weight: 600;
                    color: #333;
                    border-bottom: 2px solid #dee2e6;
                }
                .gad-table-container td {
                    padding: 12px;
                    border-bottom: 1px solid #dee2e6;
                }
                .gad-table-container tr:hover {
                    background-color: #f8f9fa;
                }
                .gad-section-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #333;
                    margin: 30px 0 15px;
                }
                .gad-table-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                }
                .gad-table-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #333;
                }
                .gad-table-actions {
                    display: flex;
                    gap: 10px;
                }
                .gad-pagination {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 15px;
                    margin-top: 20px;
                    padding: 10px;
                }
                .gad-pagination button {
                    background: #fff;
                    border: 1px solid #dee2e6;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 500;
                    color: #333;
                    transition: all 0.2s;
                }
                .gad-pagination button:hover:not(:disabled) {
                    background: #f8f9fa;
                    border-color: #c1c9d0;
                }
                .gad-pagination button:disabled {
                    background: #f8f9fa;
                    color: #adb5bd;
                    cursor: not-allowed;
                }
                .gad-pagination #page-info {
                    font-size: 14px;
                    color: #666;
                    padding: 0 10px;
                }
            </style>
        `;

        // Create daily leads table HTML
        let dailyLeadsHtml = `
            ${tableStyles}
            <h2 class="gad-section-title">Daily Lead Count</h2>
            <div class="gad-table-container">
                <div class="gad-table-header">
                    <div class="gad-table-title">
                        Daily Submission Statistics
                        <span class="gad-table-count">(Showing all entries)</span>
                    </div>
                    <div class="gad-table-actions">
                        <button id="gad-export-daily-csv" class="button">
                            <i class="fas fa-download"></i> Export CSV
                        </button>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Number of Submissions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        // Add rows for daily stats without any limitation
        Object.entries(response.data.daily_stats)
            .sort((a, b) => new Date(b[0]) - new Date(a[0])) // Sort by date descending
            .forEach(([date, count]) => {
                const formattedDate = moment(date).format('MMM D, YYYY');
                dailyLeadsHtml += `
                    <tr>
                        <td>${formattedDate}</td>
                        <td>${count}</td>
                    </tr>
                `;
            });

        dailyLeadsHtml += `
                    </tbody>
                </table>
            </div>
        `;

        // Render user submissions table if data exists
        let userSubmissionsHtml = '';
        if (response.data.users_data && response.data.users_data.length > 0) {
            const fields = Object.keys(response.data.users_data[0].fields);
            
            // Calculate total pages
            totalPages = Math.ceil(response.data.users_data.length / itemsPerPage);
            currentPage = 1; // Reset to first page when new data is loaded

            userSubmissionsHtml = `
                <h2 class="gad-section-title">User Submissions</h2>
                <div class="gad-table-container">
                    <div class="gad-table-header">
                        <div class="gad-table-title">
                            Showing ${Math.min(itemsPerPage, response.data.users_data.length)} of ${response.data.users_data.length} entries
                        </div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Name</th>
                                ${fields.filter(field => field !== 'Name').map(field => `<th>${field}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody id="users-table-body">
                        </tbody>
                    </table>
                    <div class="gad-pagination">
                        <button id="prev-page" class="button" ${currentPage === 1 ? 'disabled' : ''}>
                            <i class="fas fa-chevron-left"></i> Previous
                        </button>
                        <span id="page-info">Page ${currentPage} of ${totalPages}</span>
                        <button id="next-page" class="button" ${currentPage === totalPages ? 'disabled' : ''}>
                            Next <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
            `;
        }

        // Combine both tables and render
        $('#gad-data-table').html(dailyLeadsHtml + userSubmissionsHtml);

        // Set up export for daily leads
        $('#gad-export-daily-csv').on('click', function() {
            let csvContent = "Date,Submissions\n";
            Object.entries(response.data.daily_stats)
                .sort((a, b) => new Date(b[0]) - new Date(a[0]))
                .forEach(([date, count]) => {
                    csvContent += `${date},${count}\n`;
                });
            
            // Create and trigger download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            
            const formName = $('#gad-form-select option:selected').text().replace(/[^a-z0-9]/gi, '_').toLowerCase();
            link.setAttribute("download", `daily_leads_${formName}_${$('#gad-start-date').val()}_to_${$('#gad-end-date').val()}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });

        // If user submissions exist, set up their functionality
        if (response.data.users_data && response.data.users_data.length > 0) {
            const fields = Object.keys(response.data.users_data[0].fields);

            // Function to render table rows for current page
            function renderTableRows(page) {
                const start = (page - 1) * itemsPerPage;
                const end = start + itemsPerPage;
                const paginatedData = response.data.users_data.slice(start, end);
                
                return paginatedData.map(user => {
                    const date = moment(user.date_created).format('MMM D, YYYY');
                    return `
                        <tr>
                            <td>${date}</td>
                            <td>${user.fields['Name'] || ''}</td>
                            ${fields.filter(field => field !== 'Name')
                                .map(field => `<td>${user.fields[field] || ''}</td>`)
                                .join('')}
                        </tr>
                    `;
                }).join('');
            }

            // Function to update pagination controls
            function updatePaginationControls() {
                $('#page-info').text(`Page ${currentPage} of ${totalPages}`);
                $('#prev-page').prop('disabled', currentPage === 1);
                $('#next-page').prop('disabled', currentPage === totalPages);
                $('.gad-table-title').text(`Showing ${Math.min(itemsPerPage, response.data.users_data.length - (currentPage - 1) * itemsPerPage)} of ${response.data.users_data.length} entries`);
            }

            // Initial render of table rows
            $('#users-table-body').html(renderTableRows(currentPage));

            // Pagination event handlers
            $('#prev-page').on('click', function() {
                if (currentPage > 1) {
                    currentPage--;
                    $('#users-table-body').html(renderTableRows(currentPage));
                    updatePaginationControls();
                }
            });

            $('#next-page').on('click', function() {
                if (currentPage < totalPages) {
                    currentPage++;
                    $('#users-table-body').html(renderTableRows(currentPage));
                    updatePaginationControls();
                }
            });

            // Set up export buttons
            $('#gad-export-csv').off('click').on('click', function(e) {
                e.preventDefault();
                if (!response.data.users_data || !response.data.users_data.length) {
                    alert('No data available to export');
                    return;
                }

                const fields = Object.keys(response.data.users_data[0].fields).filter(field => field !== 'Name');
                let csvContent = "data:text/csv;charset=utf-8,";
                csvContent += "ID,Date Submitted,Name," + fields.join(',') + "\n";

                response.data.users_data.forEach(user => {
                    const date = moment(user.date_created).format('YYYY-MM-DD HH:mm:ss');
                    const name = user.fields['Name'] || '';
                    const escapedName = name.includes(',') ? `"${name.replace(/"/g, '""')}"` : name;
                    
                    let row = [
                        user.id,
                        date,
                        escapedName
                    ];

                    fields.forEach(field => {
                        let value = user.fields[field] || '';
                        value = value.toString().replace(/"/g, '""');
                        row.push(value.includes(',') ? `"${value}"` : value);
                    });

                    csvContent += row.join(',') + "\n";
                });

                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", `user_submissions_${$('#gad-form-select option:selected').text().replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${$('#gad-start-date').val()}_to_${$('#gad-end-date').val()}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });

            $('#gad-export-pdf').off('click').on('click', function(e) {
                e.preventDefault();
                if (!response.data.users_data || !response.data.users_data.length) {
                    alert('No data available to export');
                    return;
                }

                const formName = $('#gad-form-select option:selected').text();
                const dateRange = $('#gad-date-range').val();
                const fields = Object.keys(response.data.users_data[0].fields).filter(field => field !== 'Name');

                let printContent = `
                    <html>
                        <head>
                            <title>User Submissions - ${formName}</title>
                            <style>
                                body { 
                                    font-family: Arial, sans-serif; 
                                    padding: 20px; 
                                    color: #333;
                                }
                                .header { 
                                    text-align: center; 
                                    margin-bottom: 20px;
                                    padding-bottom: 10px;
                                    border-bottom: 2px solid #eee;
                                }
                                table { 
                                    width: 100%; 
                                    border-collapse: collapse; 
                                    margin: 20px 0;
                                    font-size: 12px;
                                }
                                th { 
                                    background: #f8f9fa; 
                                    padding: 8px;
                                    text-align: left; 
                                    font-weight: bold;
                                    border: 1px solid #dee2e6;
                                }
                                td { 
                                    padding: 8px;
                                    border: 1px solid #dee2e6;
                                }
                                tr:nth-child(even) { 
                                    background-color: #f9f9f9; 
                                }
                                .footer { 
                                    text-align: center; 
                                    margin-top: 20px;
                                    font-size: 10px;
                                    color: #666;
                                }
                                @media print {
                                    body { margin: 0; padding: 10px; }
                                    th { background-color: #f8f9fa !important; }
                                    tr:nth-child(even) { background-color: #f9f9f9 !important; }
                                }
                            </style>
                        </head>
                        <body>
                            <div class="header">
                                <h2>User Submissions Report</h2>
                                <h3>${formName}</h3>
                                <p>Period: ${dateRange}</p>
                            </div>
                            <table>
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Date</th>
                                        <th>Name</th>
                                        ${fields.map(field => `<th>${field}</th>`).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                `;

                response.data.users_data.forEach(user => {
                    const date = moment(user.date_created).format('MMM D, YYYY HH:mm:ss');
                    printContent += `
                        <tr>
                            <td>${user.id}</td>
                            <td>${date}</td>
                            <td>${user.fields['Name'] || ''}</td>
                            ${fields.map(field => `<td>${user.fields[field] || ''}</td>`).join('')}
                        </tr>
                    `;
                });

                printContent += `
                                </tbody>
                            </table>
                            <div class="footer">
                                <p>Generated on ${moment().format('MMMM D, YYYY HH:mm:ss')} | Total Submissions: ${response.data.users_data.length}</p>
                            </div>
                        </body>
                    </html>
                `;

                const printWindow = window.open('', '_blank');
                printWindow.document.write(printContent);
                printWindow.document.close();

                // Wait for content to load before printing
                setTimeout(() => {
                    printWindow.print();
                }, 500);
            });
        }

        // Show results container
        $('#gad-results-container').show();
    }

    function renderChart(data) {
        // Destroy existing chart if it exists
        if (chartInstance) {
            chartInstance.destroy();
        }

        // Get the canvas element
        const ctx = document.getElementById('gad-chart').getContext('2d');

        // Prepare data for the chart
        const dates = Object.keys(data.daily_stats).sort();
        const submissions = dates.map(date => data.daily_stats[date]);

        // Format dates for display
        const formattedDates = dates.map(date => moment(date).format('MMM D'));

        // Set up chart configuration
        const config = {
            type: currentChartType === 'bar' ? 'bar' : 'line',
            data: {
                labels: formattedDates,
                datasets: [{
                    label: 'Submissions',
                    data: submissions,
                    backgroundColor: currentChartType === 'area' ? 'rgba(54, 162, 235, 0.2)' : 'rgba(54, 162, 235, 0.8)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 2,
                    fill: currentChartType === 'area',
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            title: function(context) {
                                return moment(dates[context[0].dataIndex]).format('MMMM D, YYYY');
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        };

        // Create new chart instance
        chartInstance = new Chart(ctx, config);
    }

    // Function to load detailed submission data
    function loadSubmissionData() {
        const formID = $('#gad-form-select').val();
        const startDate = $('#gad-start-date').val();
        const endDate = $('#gad-end-date').val();
        
        // Show loading in the submissions area
        $('#gad-submissions-container').html('<div class="gad-loading" style="display:flex;"><div class="gad-loading-spinner"></div><span>Loading submission data...</span></div>');
        
        $.ajax({
            url: gad_ajax.ajax_url,
            method: 'POST',
            data: {
                action: 'get_submission_data',
                security: gad_ajax.nonce,
                form_id: formID,
                start_date: startDate,
                end_date: endDate
            },
            dataType: 'json',
            success: function(response) {
                if (response.success && Array.isArray(response.data) && response.data.length > 0) {
                    renderSubmissionData(response.data);
                } else {
                    $('#gad-submissions-container').html('<p>No submission data available for the selected period.</p>');
                }
            },
            error: function() {
                $('#gad-submissions-container').html('<p>Error loading submission data.</p>');
            }
        });
    }
    
    // Function to render submission data
    function renderSubmissionData(submissions) {
        // Get field headers from the first submission
        const firstSubmission = submissions[0];
        const allFields = Object.keys(firstSubmission.fields);
        
        // Identify common user-related fields (prioritize these)
        const userFields = [];
        const otherFields = [];
        
        // Look for user-related fields (case-insensitive matching)
        allFields.forEach(field => {
            const lowerField = field.toLowerCase();
            if (
                lowerField.includes('name') || 
                lowerField.includes('email') || 
                lowerField.includes('phone') || 
                lowerField.includes('source') || 
                lowerField.includes('address') || 
                lowerField.includes('company') || 
                lowerField.includes('user') ||
                lowerField.includes('contact')
            ) {
                userFields.push(field);
            } else {
                otherFields.push(field);
            }
        });
        
        // Sort user fields to show name and email first if they exist
        userFields.sort((a, b) => {
            const aLower = a.toLowerCase();
            const bLower = b.toLowerCase();
            
            // Name fields first
            if (aLower.includes('name') && !bLower.includes('name')) return -1;
            if (!aLower.includes('name') && bLower.includes('name')) return 1;
            
            // Then email fields
            if (aLower.includes('email') && !bLower.includes('email')) return -1;
            if (!aLower.includes('email') && bLower.includes('email')) return 1;
            
            return 0;
        });
        
        // Combine fields with user fields first
        const orderedFields = [...userFields, ...otherFields];
        
        // Create container with export buttons
        let html = `
            <div class="gad-submissions-actions">
                <button id="gad-export-submissions-csv" class="button">
                    <i class="fas fa-file-csv"></i> Export to CSV
                </button>
                <button id="gad-export-submissions-excel" class="button">
                    <i class="fas fa-file-excel"></i> Export to Excel
                </button>
                <span class="gad-results-count">Showing ${submissions.length} submissions</span>
            </div>
            
            <div class="gad-table-container">
                <style>
                    .gad-submissions-table th.user-data,
                    .gad-submissions-table td.user-data {
                        background-color: #f0f7ff;
                        font-weight: bold;
                    }
                    .gad-submissions-table {
                        table-layout: fixed;
                        width: 100%;
                    }
                    .gad-table-container {
                        overflow-x: auto;
                        margin-top: 15px;
                    }
                    .gad-submissions-table th {
                        position: sticky;
                        top: 0;
                        background-color: #f1f1f1;
                        z-index: 10;
                    }
                    .gad-submissions-table td {
                        max-width: 250px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    }
                    .gad-submissions-table td:hover {
                        white-space: normal;
                        word-wrap: break-word;
                    }
                </style>
                
                <table class="widefat gad-submissions-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Date</th>
                            ${userFields.map(field => `<th class="user-data">${field}</th>`).join('')}
                            ${otherFields.map(field => `<th>${field}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Add rows for each submission
        submissions.forEach(submission => {
            const date = new Date(submission.date_created).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            html += `
                <tr>
                    <td>${submission.id}</td>
                    <td>${date}</td>
            `;
            
            // Add user data cells first (highlighted)
            userFields.forEach(field => {
                const value = submission.fields[field] || '';
                html += `<td class="user-data">${value}</td>`;
            });
            
            // Then add other field cells
            otherFields.forEach(field => {
                const value = submission.fields[field] || '';
                html += `<td>${value}</td>`;
            });
            
            html += `</tr>`;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        // Insert HTML
        $('#gad-submissions-container').html(html);
        
        // Add event listeners for export buttons
        $('#gad-export-submissions-csv').on('click', function() {
            exportSubmissionsToCSV(submissions, orderedFields);
        });
        
        $('#gad-export-submissions-excel').on('click', function() {
            exportSubmissionsToExcel(submissions, orderedFields);
        });
    }
    
    // Function to export submissions to CSV
    function exportSubmissionsToCSV(submissions, fields) {
        let csvContent = "ID,Date," + fields.join(',') + "\n";
        
        submissions.forEach(submission => {
            const date = new Date(submission.date_created).toISOString().split('T')[0];
            let row = `${submission.id},${date},`;
            
            fields.forEach((field, index) => {
                // Handle values that might contain commas
                let value = submission.fields[field] || '';
                value = value.toString().replace(/"/g, '""'); // Escape quotes
                
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    value = `"${value}"`;
                }
                
                row += value;
                if (index < fields.length - 1) row += ',';
            });
            
            csvContent += row + "\n";
        });
        
        // Create and trigger download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        
        // Get form name for filename
        const formName = $('#gad-form-select option:selected').text().replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const startDate = $('#gad-start-date').val();
        const endDate = $('#gad-end-date').val();
        
        link.setAttribute("download", `gravity_submissions_${formName}_${startDate}_to_${endDate}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    // Function to export submissions to Excel-compatible format
    function exportSubmissionsToExcel(submissions, fields) {
        // Create worksheet
        let excelContent = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
        excelContent += '<head><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Submissions</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>';
        excelContent += '<body><table>';
        
        // Header row
        excelContent += '<tr><th>ID</th><th>Date</th>';
        fields.forEach(field => {
            excelContent += `<th>${field}</th>`;
        });
        excelContent += '</tr>';
        
        // Data rows
        submissions.forEach(submission => {
            const date = new Date(submission.date_created).toLocaleDateString();
            excelContent += `<tr><td>${submission.id}</td><td>${date}</td>`;
            
            fields.forEach(field => {
                const value = submission.fields[field] || '';
                excelContent += `<td>${value}</td>`;
            });
            
            excelContent += '</tr>';
        });
        
        excelContent += '</table></body></html>';
        
        // Create and trigger download
        const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        
        // Get form name for filename
        const formName = $('#gad-form-select option:selected').text().replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const startDate = $('#gad-start-date').val();
        const endDate = $('#gad-end-date').val();
        
        link.setAttribute("download", `gravity_submissions_${formName}_${startDate}_to_${endDate}.xls`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
});