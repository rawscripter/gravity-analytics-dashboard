<?php

/**
 * Plugin Name: Gravity Analytics Dashboard
 * Description: A custom dashboard to show Gravity Forms submissions analytics with improved UI.
 * Version: 1.2
 * Author: Shuvo Goswami
 */

// Exit if accessed directly.
if (! defined('ABSPATH')) {
    exit;
}

/**
 * Add an admin menu page for the analytics dashboard.
 */
function gad_add_admin_menu()
{
    add_menu_page(
        'Gravity Analytics',
        'Gravity Analytics',
        'manage_options',
        'gravity-analytics',
        'gad_render_dashboard',
        'dashicons-chart-line',
        6
    );
}
add_action('admin_menu', 'gad_add_admin_menu');

/**
 * Enqueue scripts and styles.
 */
function gad_enqueue_scripts($hook)
{
    // Only load on our plugin's admin page.
    if ('toplevel_page_gravity-analytics' !== $hook) {
        return;
    }

    // Enqueue Chart.js from a CDN.
    wp_enqueue_script('chartjs', 'https://cdn.jsdelivr.net/npm/chart.js', array(), null, true);

    // Add daterangepicker and dependencies
    wp_enqueue_script('moment', 'https://cdn.jsdelivr.net/momentjs/latest/moment.min.js', array(), null, true);
    wp_enqueue_script('daterangepicker', 'https://cdn.jsdelivr.net/npm/daterangepicker/daterangepicker.min.js', array('jquery', 'moment'), null, true);
    wp_enqueue_style('daterangepicker', 'https://cdn.jsdelivr.net/npm/daterangepicker/daterangepicker.css', array(), null);

    // Add FontAwesome for icons
    wp_enqueue_style('fontawesome', 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css', array(), '6.4.0');

    // Enqueue our custom JS.
    wp_enqueue_script('gad-custom-js', plugin_dir_url(__FILE__) . 'gad-custom.js', array('jquery', 'chartjs', 'daterangepicker'), '1.2', true);

    // Localize variables for our script.
    wp_localize_script('gad-custom-js', 'gad_ajax', array(
        'ajax_url' => admin_url('admin-ajax.php'),
        'nonce'    => wp_create_nonce('gravity_analytics_nonce'),
    ));

    // Enhanced CSS for a modern dashboard appearance
    $custom_css = "
        .gad-container {
             margin: 20px 15px 0 5px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
        }
        
        .gad-header {
            display: flex;
            align-items: center;
            margin-bottom: 30px;
        }
        
        .gad-header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }
        
        .gad-header i {
            font-size: 28px;
            margin-right: 15px;
            color: #2271b1;
        }
        
        .gad-card {
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            padding: 24px;
            margin-bottom: 25px;
            border: 1px solid #e2e4e7;
        }
        
        .gad-filter-form {
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-gap: 20px;
            align-items: center;
        }
        
        .gad-form-group {
            margin-bottom: 0;
        }
        
        .gad-form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: #1d2327;
        }
        
        .gad-form-control {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #dcdcde;
            border-radius: 4px;
            font-size: 14px;
            height: 40px;
        }
        
        .gad-btn-submit {
            grid-column: 1 / -1;
            justify-self: end;
            padding: 10px 20px;
            font-size: 14px;
            font-weight: 500;
            height: 40px;
            background: #2271b1;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.2s ease;
        }
        
        .gad-btn-submit:hover {
            background: #135e96;
        }
        
        .gad-btn-submit i {
            margin-right: 8px;
        }
        
        .gad-loading {
            display: none;
            justify-content: center;
            padding: 30px 0;
        }
        
        .gad-loading-spinner {
            border: 3px solid rgba(0, 0, 0, 0.1);
            border-radius: 50%;
            border-top: 3px solid #2271b1;
            width: 24px;
            height: 24px;
            animation: spin 1s linear infinite;
            margin-right: 10px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .gad-summary-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            grid-gap: 20px;
            margin-bottom: 25px;
        }
        
        .gad-summary-box {
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            padding: 20px;
            border-left: 4px solid;
            display: flex;
            align-items: center;
        }
        
        .gad-summary-box.total {
            border-left-color: #4285f4;
        }
        
        .gad-summary-box.average {
            border-left-color: #34a853;
        }
        
        .gad-summary-box.peak {
            border-left-color: #ea4335;
        }
        
        .gad-icon-wrapper {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 15px;
            color: white;
        }
        
        .gad-summary-box.total .gad-icon-wrapper {
            background-color: #4285f4;
        }
        
        .gad-summary-box.average .gad-icon-wrapper {
            background-color: #34a853;
        }
        
        .gad-summary-box.peak .gad-icon-wrapper {
            background-color: #ea4335;
        }
        
        .gad-summary-content h3 {
            margin: 0 0 5px 0;
            font-size: 14px;
            font-weight: 500;
            color: #50575e;
        }
        
        .gad-summary-content p {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
            color: #1d2327;
        }
        
        .gad-chart-container {
            position: relative;
            height: 400px;
            margin-bottom: 25px;
        }
        
        .gad-table-container table {
            width: 100%;
            border-collapse: collapse;
            border: none;
        }
        
        .gad-table-container thead {
            background-color: #f9fafb;
        }
        
        .gad-table-container th {
            text-align: left;
            padding: 12px 15px;
            font-weight: 600;
            font-size: 14px;
            color: #1d2327;
            border-bottom: 1px solid #dcdcde;
        }
        
        .gad-table-container td {
            padding: 12px 15px;
            border-bottom: 1px solid #dcdcde;
        }
        
        .gad-table-container tr:hover {
            background-color: #f9fafb;
        }
        
        .gad-table-container tr:nth-child(even) {
            background-color: #f9fafb;
        }
        
        .gad-no-data {
            text-align: center;
            padding: 40px;
            color: #757575;
            font-size: 16px;
        }
        
        .daterangepicker {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
            font-size: 14px;
            border-radius: 4px;
            border: 1px solid #dcdcde;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .daterangepicker .calendar-table {
            border-radius: 4px;
        }
        
        .daterangepicker td.active, .daterangepicker td.active:hover {
            background-color: #2271b1;
        }
        
        .gad-export-tools {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #e2e4e7;
        }
        
        .gad-export-btn {
            background: #f6f7f7;
            border: 1px solid #dcdcde;
            border-radius: 4px;
            padding: 6px 12px;
            font-size: 13px;
            cursor: pointer;
            display: flex;
            align-items: center;
            transition: all 0.2s ease;
        }
        
        .gad-export-btn:hover {
            background: #f0f0f1;
            border-color: #c5c5c7;
        }
        
        .gad-export-btn i {
            margin-right: 6px;
        }
        
        .gad-chart-controls {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 15px;
        }
        
        .gad-chart-type-selector {
            display: flex;
            align-items: center;
        }
        
        .gad-chart-type-selector label {
            margin-right: 10px;
            font-weight: 500;
        }
        
        .gad-chart-type-buttons {
            display: flex;
            border-radius: 4px;
            overflow: hidden;
            border: 1px solid #dcdcde;
        }
        
        .gad-chart-type-btn {
            background: #f6f7f7;
            border: none;
            border-right: 1px solid #dcdcde;
            padding: 8px 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            font-size: 13px;
        }
        
        .gad-chart-type-btn:last-child {
            border-right: none;
        }
        
        .gad-chart-type-btn i {
            margin-right: 5px;
        }
        
        .gad-chart-type-btn.active {
            background: #2271b1;
            color: white;
        }

        .gad-tabs {
            display: flex;
            border-bottom: 1px solid #dcdcde;
            margin-bottom: 25px;
        }
        
        .gad-tab-btn {
            padding: 12px 20px;
            background: transparent;
            border: none;
            border-bottom: 3px solid transparent;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            display: flex;
            align-items: center;
            color: #50575e;
            margin-right: 10px;
        }
        
        .gad-tab-btn i {
            margin-right: 8px;
            font-size: 16px;
        }
        
        .gad-tab-btn.active {
            color: #2271b1;
            border-bottom-color: #2271b1;
        }
        
        .gad-tab-content {
            display: none;
        }
        
        .gad-tab-content.active {
            display: block;
        }
        
        .gad-field-stats-container {
            padding: 10px;
        }
        
        .gad-field-stats-container h3 {
            font-size: 16px;
            margin-top: 0;
            margin-bottom: 20px;
            color: #23282d;
        }
        
        .gad-field-stats-container h3 i {
            margin-right: 8px;
            color: #2271b1;
        }
        
        .gad-report-settings {
            padding: 10px;
        }
        
        .gad-report-settings h3 {
            font-size: 16px;
            margin-top: 0;
            margin-bottom: 10px;
            color: #23282d;
        }
        
        .gad-report-settings h3 i {
            margin-right: 8px;
            color: #2271b1;
        }
        
        .gad-description {
            margin-top: 0;
            margin-bottom: 20px;
            color: #50575e;
        }
        
        .gad-schedule-form {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }
        
        .gad-report-option {
            margin-bottom: 15px;
        }
        
        .gad-report-option label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
        }
        
        .gad-hint {
            margin-top: 5px;
            margin-bottom: 0;
            font-size: 12px;
            color: #757575;
        }
        
        .gad-frequency-options,
        .gad-format-options {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
        }
        
        .gad-radio-label,
        .gad-checkbox-label {
            display: flex;
            align-items: center;
            cursor: pointer;
        }
        
        .gad-radio-label span,
        .gad-checkbox-label span {
            margin-left: 8px;
        }
        
        .gad-report-buttons {
            display: flex;
            gap: 15px;
            margin-top: 10px;
        }
        
        .gad-btn-secondary {
            padding: 10px 20px;
            font-size: 14px;
            font-weight: 500;
            height: 40px;
            background: #f6f7f7;
            color: #2c3338;
            border: 1px solid #dcdcde;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .gad-btn-secondary:hover {
            background: #f0f0f1;
        }
        
        .gad-btn-secondary i {
            margin-right: 8px;
        }
        
        .gad-schedule-status {
            display: flex;
            align-items: center;
            margin-top: 25px;
            padding: 15px;
            background-color: #f0f6e6;
            border-left: 4px solid #34a853;
            border-radius: 4px;
        }
        
        .gad-status-icon {
            margin-right: 15px;
            font-size: 24px;
            color: #34a853;
        }
        
        .gad-status-content h4 {
            margin: 0 0 5px 0;
            font-size: 16px;
        }
        
        .gad-status-content p {
            margin: 0;
            color: #50575e;
        }
        
        .gad-scheduled-reports {
            padding: 10px;
        }
        
        .gad-scheduled-reports h3 {
            font-size: 16px;
            margin-top: 0;
            margin-bottom: 20px;
            color: #23282d;
        }
        
        .gad-scheduled-reports h3 i {
            margin-right: 8px;
            color: #2271b1;
        }
        
        .gad-no-reports-message {
            padding: 20px;
            text-align: center;
            color: #757575;
            font-style: italic;
        }
    ";
    wp_add_inline_style('wp-admin', $custom_css);
}
add_action('admin_enqueue_scripts', 'gad_enqueue_scripts');

/**
 * Render the dashboard HTML.
 */
function gad_render_dashboard()
{
    // Get all forms using GFAPI (Gravity Forms must be active).
    if (! class_exists('GFAPI')) {
        echo '<div class="wrap"><p>Gravity Forms is not active.</p></div>';
        return;
    }
    $forms = GFAPI::get_forms();
?>
    <div class="wrap">
        <div class="gad-container">
            <div class="gad-header">
                <i class="fas fa-chart-line"></i>
                <h1>Gravity Analytics Dashboard</h1>
            </div>

            <div class="gad-card">
                <form id="gad-filter-form" class="gad-filter-form">
                    <div class="gad-form-group">
                        <label for="gad-form-select"><i class="fas fa-list-alt"></i> Select Form</label>
                        <select id="gad-form-select" name="form_id" class="gad-form-control" required>
                            <option value="">-- Select a form --</option>
                            <?php
                            if (is_array($forms)) {
                                foreach ($forms as $form) {
                                    echo '<option value="' . esc_attr($form['id']) . '">' . esc_html($form['title']) . '</option>';
                                }
                            }
                            ?>
                        </select>
                    </div>

                    <div class="gad-form-group">
                        <label for="gad-date-range"><i class="fas fa-calendar-alt"></i> Date Range</label>
                        <input type="text" id="gad-date-range" class="gad-form-control" readonly>
                        <input type="hidden" id="gad-start-date" name="start_date">
                        <input type="hidden" id="gad-end-date" name="end_date">
                    </div>

                    <button type="submit" class="gad-btn-submit">
                        <i class="fas fa-search"></i> Show Analytics
                    </button>
                </form>
            </div>

            <div id="gad-loading" class="gad-loading">
                <div class="gad-loading-spinner"></div>
                <span>Loading data...</span>
            </div>

            <div id="gad-results-container" style="display: none;">
                <div class="gad-tabs">
                    <button type="button" class="gad-tab-btn active" data-tab="submissions">
                        <i class="fas fa-chart-line"></i> Submission Trends
                    </button>
                    <button type="button" class="gad-tab-btn" data-tab="fields">
                        <i class="fas fa-clipboard-list"></i> Field Analysis
                    </button>
                    <button type="button" class="gad-tab-btn" data-tab="reports">
                        <i class="fas fa-envelope"></i> Email Reports
                    </button>
                </div>

                <div id="gad-tab-submissions" class="gad-tab-content active">
                    <div class="gad-summary-stats">
                        <div class="gad-summary-box total">
                            <div class="gad-icon-wrapper">
                                <i class="fas fa-file-alt"></i>
                            </div>
                            <div class="gad-summary-content">
                                <h3>Total Submissions</h3>
                                <p id="gad-total-submissions">0</p>
                            </div>
                        </div>

                        <div class="gad-summary-box average">
                            <div class="gad-icon-wrapper">
                                <i class="fas fa-chart-bar"></i>
                            </div>
                            <div class="gad-summary-content">
                                <h3>Average Daily</h3>
                                <p id="gad-average-daily">0</p>
                            </div>
                        </div>

                        <div class="gad-summary-box peak">
                            <div class="gad-icon-wrapper">
                                <i class="fas fa-calendar-check"></i>
                            </div>
                            <div class="gad-summary-content">
                                <h3>Peak Day</h3>
                                <p id="gad-peak-day">N/A</p>
                            </div>
                        </div>
                    </div>

                    <div class="gad-card">
                        <div class="gad-chart-controls">
                            <div class="gad-chart-type-selector">
                                <label>Chart Type:</label>
                                <div class="gad-chart-type-buttons">
                                    <button type="button" class="gad-chart-type-btn active" data-type="line"><i class="fas fa-chart-line"></i> Line</button>
                                    <button type="button" class="gad-chart-type-btn" data-type="bar"><i class="fas fa-chart-bar"></i> Bar</button>
                                    <button type="button" class="gad-chart-type-btn" data-type="area"><i class="fas fa-chart-area"></i> Area</button>
                                </div>
                            </div>
                        </div>
                        <div class="gad-chart-container">
                            <canvas id="gad-chart"></canvas>
                        </div>
                        <div class="gad-export-tools">
                            <button id="gad-export-csv" class="gad-export-btn"><i class="fas fa-file-csv"></i> Export CSV</button>
                            <button id="gad-export-pdf" class="gad-export-btn"><i class="fas fa-file-pdf"></i> Export PDF</button>
                            <button id="gad-print-chart" class="gad-export-btn"><i class="fas fa-print"></i> Print Chart</button>
                        </div>
                    </div>

                    <div class="gad-card">
                        <div class="gad-table-container" id="gad-data-table">
                            <!-- Table will be dynamically inserted here -->
                        </div>
                    </div>
                </div>

                <div id="gad-tab-fields" class="gad-tab-content">
                    <div class="gad-card">
                        <div class="gad-field-stats-container">
                            <h3><i class="fas fa-clipboard-check"></i> Form Field Completion Rates</h3>
                            <div id="gad-field-completion-chart-container" class="gad-chart-container">
                                <canvas id="gad-field-completion-chart"></canvas>
                            </div>
                            <div class="gad-field-table-container" id="gad-field-stats-table">
                                <!-- Field stats table will be inserted here -->
                            </div>
                        </div>
                    </div>
                </div>

                <div id="gad-tab-reports" class="gad-tab-content">
                    <div class="gad-card">
                        <div class="gad-report-settings">
                            <h3><i class="fas fa-envelope"></i> Schedule Email Reports</h3>
                            <p class="gad-description">Automatically receive analytics reports for this form on a scheduled basis.</p>

                            <form id="gad-schedule-form" class="gad-schedule-form">
                                <div class="gad-report-option">
                                    <label for="gad-report-email">Email Recipients:</label>
                                    <input type="text" id="gad-report-email" class="gad-form-control" placeholder="email@example.com, anotheremail@example.com">
                                    <p class="gad-hint">Separate multiple email addresses with commas.</p>
                                </div>

                                <div class="gad-report-option">
                                    <label>Report Frequency:</label>
                                    <div class="gad-frequency-options">
                                        <label class="gad-radio-label">
                                            <input type="radio" name="gad-frequency" value="weekly" checked>
                                            <span>Weekly</span>
                                        </label>
                                        <label class="gad-radio-label">
                                            <input type="radio" name="gad-frequency" value="monthly">
                                            <span>Monthly</span>
                                        </label>
                                        <label class="gad-radio-label">
                                            <input type="radio" name="gad-frequency" value="quarterly">
                                            <span>Quarterly</span>
                                        </label>
                                    </div>
                                </div>

                                <div class="gad-report-option">
                                    <label>Report Format:</label>
                                    <div class="gad-format-options">
                                        <label class="gad-checkbox-label">
                                            <input type="checkbox" name="gad-format[]" value="chart" checked>
                                            <span>Include Chart</span>
                                        </label>
                                        <label class="gad-checkbox-label">
                                            <input type="checkbox" name="gad-format[]" value="summary" checked>
                                            <span>Include Summary Stats</span>
                                        </label>
                                        <label class="gad-checkbox-label">
                                            <input type="checkbox" name="gad-format[]" value="table" checked>
                                            <span>Include Data Table</span>
                                        </label>
                                        <label class="gad-checkbox-label">
                                            <input type="checkbox" name="gad-format[]" value="fields">
                                            <span>Include Field Analysis</span>
                                        </label>
                                    </div>
                                </div>

                                <div class="gad-report-buttons">
                                    <button type="submit" class="gad-btn-submit" id="gad-save-schedule">
                                        <i class="fas fa-calendar-check"></i> Schedule Reports
                                    </button>
                                    <button type="button" class="gad-btn-secondary" id="gad-send-test">
                                        <i class="fas fa-paper-plane"></i> Send Test Report
                                    </button>
                                </div>
                            </form>

                            <div class="gad-schedule-status" id="gad-schedule-status" style="display: none;">
                                <div class="gad-status-icon">
                                    <i class="fas fa-check-circle"></i>
                                </div>
                                <div class="gad-status-content">
                                    <h4>Reports Scheduled Successfully</h4>
                                    <p>Your analytics reports have been scheduled. The first report will be sent according to your selected frequency.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="gad-card">
                        <div class="gad-scheduled-reports">
                            <h3><i class="fas fa-calendar-alt"></i> Active Scheduled Reports</h3>

                            <div id="gad-reports-table-container">
                                <!-- Table of scheduled reports will be loaded here -->
                                <p class="gad-no-reports-message">No reports are currently scheduled for this form.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div id="gad-no-data" class="gad-card gad-no-data" style="display: none;">
                <i class="fas fa-info-circle"></i> No data available for the selected date range.
            </div>
        </div>
    </div>
<?php
}

/**
 * AJAX handler to retrieve form entries grouped by day.
 */
function gad_get_form_data()
{
    check_ajax_referer('gravity_analytics_nonce', 'security');

    $form_id    = isset($_POST['form_id']) ? absint($_POST['form_id']) : 0;
    $start_date = isset($_POST['start_date']) ? sanitize_text_field($_POST['start_date']) : '';
    $end_date   = isset($_POST['end_date']) ? sanitize_text_field($_POST['end_date']) : '';

    if (! $form_id || ! $start_date || ! $end_date) {
        wp_send_json_error('Invalid parameters.');
    }

    // Build search criteria.
    $search_criteria = array(
        'start_date' => $start_date,
        'end_date'   => $end_date,
    );

    // Add paging parameters to get all entries
    $paging = array(
        'offset'    => 0,
        'page_size' => 10000 // Get up to 10000 entries at a time
    );

    // Get form structure to know which fields to extract
    $form = GFAPI::get_form($form_id);
    if (empty($form)) {
        wp_send_json_error('Invalid form.');
    }

    // Get all entries for the form in the given date range.
    $entries = GFAPI::get_entries($form_id, $search_criteria, null, $paging);
    $data = array();
    $users_data = array();

    // Group entries by day and collect user data
    if (is_array($entries)) {
        foreach ($entries as $entry) {
            // For daily stats
            $date = substr($entry['date_created'], 0, 10); // YYYY-MM-DD
            if (! isset($data[$date])) {
                $data[$date] = 0;
            }
            $data[$date]++;

            // Collect user data
            $user_info = array(
                'id' => $entry['id'],
                'date_created' => $entry['date_created'],
                'ip' => $entry['ip'],
                'source_url' => $entry['source_url'],
                'user_agent' => $entry['user_agent'],
                'fields' => array()
            );

            // Add form fields
            foreach ($form['fields'] as $field) {
                if (!in_array($field['type'], array('html', 'section', 'page', 'captcha'))) {
                    $field_id = $field['id'];
                    $field_label = $field['label'];
                    $field_value = isset($entry[$field_id]) ? $entry[$field_id] : '';

                    $user_info['fields'][$field_label] = $field_value;
                }
            }

            $users_data[] = $user_info;
        }
    }

    // Sort data by date (ascending)
    ksort($data);

    // Return both the daily stats and user data
    wp_send_json_success(array(
        'daily_stats' => $data,
        'users_data' => $users_data
    ));
}
add_action('wp_ajax_get_form_data', 'gad_get_form_data');

/**
 * AJAX handler to retrieve field completion statistics.
 */
function gad_get_field_stats()
{
    check_ajax_referer('gravity_analytics_nonce', 'security');

    $form_id    = isset($_POST['form_id']) ? absint($_POST['form_id']) : 0;
    $start_date = isset($_POST['start_date']) ? sanitize_text_field($_POST['start_date']) : '';
    $end_date   = isset($_POST['end_date']) ? sanitize_text_field($_POST['end_date']) : '';

    if (! $form_id || ! $start_date || ! $end_date) {
        wp_send_json_error('Invalid parameters.');
    }

    // Get the form structure
    $form = GFAPI::get_form($form_id);

    if (empty($form) || !is_array($form) || empty($form['fields'])) {
        wp_send_json_error('Invalid form or no fields found.');
    }

    // Build search criteria
    $search_criteria = array(
        'start_date' => $start_date,
        'end_date'   => $end_date,
    );

    // Add paging parameters to get all entries
    $paging = array(
        'offset'    => 0,
        'page_size' => 1000 // Get up to 1000 entries at a time
    );

    // Get entries
    $entries = GFAPI::get_entries($form_id, $search_criteria, null, $paging);

    if (empty($entries) || !is_array($entries)) {
        wp_send_json_error('No entries found for the specified period.');
    }

    // Process field data
    $field_stats = array();
    $entry_count = count($entries);

    foreach ($form['fields'] as $field) {
        // Skip administrative fields, HTML blocks, sections, etc.
        if (in_array($field['type'], array('html', 'section', 'page', 'captcha'))) {
            continue;
        }

        $field_id = $field['id'];
        $field_label = $field['label'];
        $filled_count = 0;

        foreach ($entries as $entry) {
            if (!empty($entry[$field_id])) {
                $filled_count++;
            }
        }

        $completion_rate = ($entry_count > 0) ? round(($filled_count / $entry_count) * 100, 1) : 0;

        $field_stats[] = array(
            'id' => $field_id,
            'label' => $field_label,
            'filled_count' => $filled_count,
            'total_entries' => $entry_count,
            'completion_rate' => $completion_rate
        );
    }

    // Sort by completion rate (descending)
    usort($field_stats, function ($a, $b) {
        return $b['completion_rate'] <=> $a['completion_rate'];
    });

    wp_send_json_success($field_stats);
}
add_action('wp_ajax_get_field_stats', 'gad_get_field_stats');

/**
 * AJAX handler to schedule email reports.
 */
function gad_schedule_report()
{
    check_ajax_referer('gravity_analytics_nonce', 'security');

    $form_id      = isset($_POST['form_id']) ? absint($_POST['form_id']) : 0;
    $email        = isset($_POST['email']) ? sanitize_text_field($_POST['email']) : '';
    $frequency    = isset($_POST['frequency']) ? sanitize_text_field($_POST['frequency']) : 'weekly';
    $format       = isset($_POST['format']) && is_array($_POST['format']) ? array_map('sanitize_text_field', $_POST['format']) : array();

    if (! $form_id || ! $email) {
        wp_send_json_error('Missing required fields.');
    }

    // Validate email addresses
    $emails = explode(',', $email);
    $valid_emails = array();

    foreach ($emails as $single_email) {
        $single_email = trim($single_email);
        if (is_email($single_email)) {
            $valid_emails[] = $single_email;
        }
    }

    if (empty($valid_emails)) {
        wp_send_json_error('No valid email addresses provided.');
    }

    // Get existing scheduled reports
    $scheduled_reports = get_option('gad_scheduled_reports', array());

    // Create a unique ID for this schedule
    $schedule_id = uniqid('gad_');

    // Add the new schedule
    $scheduled_reports[$schedule_id] = array(
        'form_id'     => $form_id,
        'emails'      => $valid_emails,
        'frequency'   => $frequency,
        'format'      => $format,
        'created_at'  => current_time('mysql'),
        'last_sent'   => '',
        'next_send'   => gad_calculate_next_send_date($frequency)
    );

    // Save updated schedules
    update_option('gad_scheduled_reports', $scheduled_reports);

    // Schedule the cron job if it's not already scheduled
    if (! wp_next_scheduled('gad_send_scheduled_reports')) {
        wp_schedule_event(time(), 'daily', 'gad_send_scheduled_reports');
    }

    wp_send_json_success('Report scheduled successfully.');
}
add_action('wp_ajax_gad_schedule_report', 'gad_schedule_report');

/**
 * AJAX handler to send a test report.
 */
function gad_send_test_report()
{
    check_ajax_referer('gravity_analytics_nonce', 'security');

    $form_id      = isset($_POST['form_id']) ? absint($_POST['form_id']) : 0;
    $email        = isset($_POST['email']) ? sanitize_text_field($_POST['email']) : '';
    $format       = isset($_POST['format']) && is_array($_POST['format']) ? array_map('sanitize_text_field', $_POST['format']) : array();

    if (! $form_id || ! $email) {
        wp_send_json_error('Missing required fields.');
    }

    // Validate email addresses
    $emails = explode(',', $email);
    $valid_emails = array();

    foreach ($emails as $single_email) {
        $single_email = trim($single_email);
        if (is_email($single_email)) {
            $valid_emails[] = $single_email;
        }
    }

    if (empty($valid_emails)) {
        wp_send_json_error('No valid email addresses provided.');
    }

    // Get form info
    $form = GFAPI::get_form($form_id);
    if (empty($form)) {
        wp_send_json_error('Invalid form.');
    }

    // Generate report data
    $start_date = date('Y-m-d', strtotime('-7 days'));
    $end_date = date('Y-m-d');

    // Get submission data
    $search_criteria = array(
        'start_date' => $start_date,
        'end_date'   => $end_date,
    );
    $entries = GFAPI::get_entries($form_id, $search_criteria);

    // Group entries by day
    $submission_data = array();
    if (is_array($entries)) {
        foreach ($entries as $entry) {
            $date = substr($entry['date_created'], 0, 10); // YYYY-MM-DD
            if (! isset($submission_data[$date])) {
                $submission_data[$date] = 0;
            }
            $submission_data[$date]++;
        }
    }

    // Sort data by date
    ksort($submission_data);

    // Generate report HTML
    $report_html = gad_generate_report_html($form, $submission_data, $format, $start_date, $end_date);

    // Send the email
    $subject = sprintf('Gravity Analytics Test Report: %s', $form['title']);
    $headers = array('Content-Type: text/html; charset=UTF-8');

    foreach ($valid_emails as $recipient) {
        $result = wp_mail($recipient, $subject, $report_html, $headers);
    }

    wp_send_json_success('Test report sent successfully.');
}
add_action('wp_ajax_gad_send_test_report', 'gad_send_test_report');

/**
 * Calculate the next send date based on frequency.
 */
function gad_calculate_next_send_date($frequency)
{
    $now = current_time('timestamp');

    switch ($frequency) {
        case 'weekly':
            // Next Monday
            $next_send = strtotime('next monday', $now);
            break;

        case 'monthly':
            // 1st of next month
            $next_send = strtotime('first day of next month', $now);
            break;

        case 'quarterly':
            // Start of next quarter
            $month = date('n', $now);
            $quarter = ceil($month / 3);
            $next_quarter = $quarter < 4 ? $quarter + 1 : 1;
            $next_quarter_month = (($next_quarter - 1) * 3) + 1;
            $next_quarter_year = $next_quarter == 1 ? date('Y', $now) + 1 : date('Y', $now);
            $next_send = strtotime("$next_quarter_year-$next_quarter_month-01");
            break;

        default:
            // Default to weekly
            $next_send = strtotime('next monday', $now);
    }

    return date('Y-m-d H:i:s', $next_send);
}

/**
 * Generate HTML for email reports.
 */
function gad_generate_report_html($form, $submission_data, $format, $start_date, $end_date)
{
    // Calculate summary statistics
    $total_submissions = 0;
    foreach ($submission_data as $count) {
        $total_submissions += $count;
    }

    $num_days = count($submission_data);
    $avg_daily = $num_days > 0 ? round($total_submissions / $num_days, 2) : 0;

    // Find peak day
    $peak_day = '';
    $peak_count = 0;
    foreach ($submission_data as $date => $count) {
        if ($count > $peak_count) {
            $peak_count = $count;
            $peak_day = $date;
        }
    }

    // Format the peak day
    if ($peak_day) {
        $peak_day_formatted = date('M j, Y', strtotime($peak_day)) . ' (' . $peak_count . ')';
    } else {
        $peak_day_formatted = 'N/A';
    }

    // Start building HTML
    $html = '
    <!DOCTYPE html>
    <html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <title>Gravity Analytics Report</title>
        <style>
            body {
                font-family: sans-serif;
                color: #333;
                line-height: 1.4;
                margin: 0;
                padding: 0;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 1px solid #eee;
            }
            .header h1 {
                color: #2271b1;
                margin: 0 0 10px 0;
            }
            .date-range {
                color: #666;
                font-style: italic;
            }
            .summary-stats {
                display: flex;
                justify-content: space-between;
                flex-wrap: wrap;
                margin-bottom: 30px;
            }
            .stat-box {
                width: 30%;
                padding: 15px;
                border-radius: 5px;
                background: #f9f9f9;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                text-align: center;
                margin-bottom: 15px;
            }
            .stat-box h3 {
                margin: 0 0 10px 0;
                color: #555;
                font-size: 14px;
            }
            .stat-box p {
                margin: 0;
                font-size: 20px;
                font-weight: bold;
                color: #333;
            }
            .chart-container {
                margin: 30px 0;
                text-align: center;
            }
            .chart-container img {
                max-width: 100%;
                height: auto;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin: 30px 0;
            }
            table th,
            table td {
                padding: 10px;
                text-align: left;
                border-bottom: 1px solid #ddd;
            }
            table th {
                background: #f1f1f1;
            }
            .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #eee;
                font-size: 12px;
                color: #777;
                text-align: center;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Gravity Forms Analytics Report</h1>
                <h2>' . esc_html($form['title']) . '</h2>
                <p class="date-range">Period: ' . date('M j, Y', strtotime($start_date)) . ' - ' . date('M j, Y', strtotime($end_date)) . '</p>
            </div>';

    // Include summary stats if requested
    if (in_array('summary', $format)) {
        $html .= '
            <div class="summary-stats">
                <div class="stat-box">
                    <h3>Total Submissions</h3>
                    <p>' . $total_submissions . '</p>
                </div>
                <div class="stat-box">
                    <h3>Average Daily</h3>
                    <p>' . $avg_daily . '</p>
                </div>
                <div class="stat-box">
                    <h3>Peak Day</h3>
                    <p>' . $peak_day_formatted . '</p>
                </div>
            </div>';
    }

    // Include chart if requested
    // Note: In a real implementation, you would need to generate the chart image server-side and include it
    if (in_array('chart', $format)) {
        $html .= '
            <div class="chart-container">
                <h3>Submissions Over Time</h3>
                <p>(Chart would appear here in actual emails)</p>
            </div>';
    }

    // Include data table if requested
    if (in_array('table', $format)) {
        $html .= '
            <h3>Submission Data</h3>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Submissions</th>
                    </tr>
                </thead>
                <tbody>';

        if (empty($submission_data)) {
            $html .= '
                    <tr>
                        <td colspan="2" style="text-align: center;">No data available for the selected period.</td>
                    </tr>';
        } else {
            foreach ($submission_data as $date => $count) {
                $formatted_date = date('M j, Y', strtotime($date));
                $html .= '
                    <tr>
                        <td>' . $formatted_date . '</td>
                        <td>' . $count . '</td>
                    </tr>';
            }
        }

        $html .= '
                </tbody>
            </table>';
    }

    // Footer
    $html .= '
            <div class="footer">
                <p>Generated on ' . date('F j, Y') . ' by Gravity Analytics Dashboard</p>
                <p>This is an automated report. Please do not reply to this email.</p>
            </div>
        </div>
    </body>
    </html>';

    return $html;
}

/**
 * Send scheduled reports when cron job runs.
 */
function gad_send_scheduled_reports()
{
    $now = current_time('mysql');
    $scheduled_reports = get_option('gad_scheduled_reports', array());
    $updated = false;

    foreach ($scheduled_reports as $id => &$report) {
        // Check if it's time to send this report
        if (strtotime($report['next_send']) <= strtotime($now)) {
            // Get form info
            $form = GFAPI::get_form($report['form_id']);
            if (empty($form)) {
                continue; // Skip if form doesn't exist
            }

            // Determine date range based on frequency
            switch ($report['frequency']) {
                case 'weekly':
                    $start_date = date('Y-m-d', strtotime('-7 days'));
                    break;

                case 'monthly':
                    $start_date = date('Y-m-d', strtotime('-1 month'));
                    break;

                case 'quarterly':
                    $start_date = date('Y-m-d', strtotime('-3 months'));
                    break;

                default:
                    $start_date = date('Y-m-d', strtotime('-7 days'));
            }

            $end_date = date('Y-m-d');

            // Get submission data
            $search_criteria = array(
                'start_date' => $start_date,
                'end_date'   => $end_date,
            );
            $entries = GFAPI::get_entries($report['form_id'], $search_criteria);

            // Group entries by day
            $submission_data = array();
            if (is_array($entries)) {
                foreach ($entries as $entry) {
                    $date = substr($entry['date_created'], 0, 10); // YYYY-MM-DD
                    if (! isset($submission_data[$date])) {
                        $submission_data[$date] = 0;
                    }
                    $submission_data[$date]++;
                }
            }

            // Sort data by date
            ksort($submission_data);

            // Generate report HTML
            $report_html = gad_generate_report_html($form, $submission_data, $report['format'], $start_date, $end_date);

            // Send the email
            $subject = sprintf('Gravity Analytics Report: %s', $form['title']);
            $headers = array('Content-Type: text/html; charset=UTF-8');

            foreach ($report['emails'] as $recipient) {
                wp_mail($recipient, $subject, $report_html, $headers);
            }

            // Update the report record
            $report['last_sent'] = $now;
            $report['next_send'] = gad_calculate_next_send_date($report['frequency']);
            $updated = true;
        }
    }

    // Save updated schedules if changes were made
    if ($updated) {
        update_option('gad_scheduled_reports', $scheduled_reports);
    }
}
add_action('gad_send_scheduled_reports', 'gad_send_scheduled_reports');

/**
 * AJAX handler to get scheduled reports for a form.
 */
function gad_get_scheduled_reports()
{
    check_ajax_referer('gravity_analytics_nonce', 'security');

    $form_id = isset($_POST['form_id']) ? absint($_POST['form_id']) : 0;

    if (! $form_id) {
        wp_send_json_error('Invalid form ID.');
    }

    $scheduled_reports = get_option('gad_scheduled_reports', array());
    $form_reports = array();

    foreach ($scheduled_reports as $id => $report) {
        if ($report['form_id'] == $form_id) {
            $report['id'] = $id;
            $form_reports[] = $report;
        }
    }

    wp_send_json_success($form_reports);
}
add_action('wp_ajax_gad_get_scheduled_reports', 'gad_get_scheduled_reports');

/**
 * AJAX handler to delete a scheduled report.
 */
function gad_delete_scheduled_report()
{
    check_ajax_referer('gravity_analytics_nonce', 'security');

    $report_id = isset($_POST['report_id']) ? sanitize_text_field($_POST['report_id']) : '';

    if (! $report_id) {
        wp_send_json_error('Invalid report ID.');
    }

    $scheduled_reports = get_option('gad_scheduled_reports', array());

    if (isset($scheduled_reports[$report_id])) {
        unset($scheduled_reports[$report_id]);
        update_option('gad_scheduled_reports', $scheduled_reports);
        wp_send_json_success('Report deleted successfully.');
    } else {
        wp_send_json_error('Report not found.');
    }
}
add_action('wp_ajax_gad_delete_scheduled_report', 'gad_delete_scheduled_report');
