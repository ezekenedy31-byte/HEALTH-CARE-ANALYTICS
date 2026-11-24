import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  Calendar,
  Database,
  Filter,
  SlidersHorizontal,
} from 'lucide-react';
import type {
  DashboardFilters,
  DashboardTab,
  ForecastAction,
  ForecastMetric,
  HospitalDatasetBundle,
} from './types/hospital';
import { loadDefaultBaselineDataset } from './utils/dataParser';
import { buildAiAnalyticsSnapshot, computeAnalytics } from './utils/analytics';
import { InsightsDashboardsView } from './components/InsightsDashboardsView';
import { AdmissionsDemandView } from './components/AdmissionsDemandView';
import { StaffWorkloadView } from './components/StaffWorkloadView';
import { BottlenecksForecastingView } from './components/BottlenecksForecastingView';
import { DataMappingModal } from './components/DataMappingModal';
import { ChatAssistant } from './components/ChatAssistant';

function shiftIsoDate(maxIso: string, daysBack: number): string {
  const dt = new Date(`${maxIso}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() - daysBack);
  return dt.toISOString().slice(0, 10);
}

const NAV_TABS: Array<{ id: DashboardTab; code: string; label: string }> = [
  { id: 'insights', code: '04', label: 'Insights & Dashboards' },
  { id: 'admissions', code: '01', label: 'Admissions & Demand' },
  { id: 'workload', code: '02', label: 'Staff Workload' },
  { id: 'bottlenecks', code: '03', label: 'Bottlenecks & Forecasting' },
];

export default function App() {
  const [dataset, setDataset] = useState<HospitalDatasetBundle | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>('insights');
  const [filters, setFilters] = useState<DashboardFilters>({
    department: 'All',
    startDate: '2025-01-01',
    endDate: '2025-12-31',
  });
  const [overtimeRateNgn, setOvertimeRateNgn] = useState<number>(4500);
  const [forecastHorizon, setForecastHorizon] = useState<number>(14);
  const [forecastMetric, setForecastMetric] = useState<ForecastMetric>('demand');
  const [isDataModalOpen, setIsDataModalOpen] = useState<boolean>(false);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);

  useEffect(() => {
    const initial = loadDefaultBaselineDataset();
    setDataset(initial);
    setFilters({
      department: 'All',
      startDate: initial.quality.dateRange.min,
      endDate: initial.quality.dateRange.max,
    });
  }, []);

  const analytics = useMemo(() => {
    if (!dataset) return null;
    return computeAnalytics(dataset, filters, overtimeRateNgn);
  }, [dataset, filters, overtimeRateNgn]);

  const aiSnapshot = useMemo(() => {
    if (!dataset) return {};
    return buildAiAnalyticsSnapshot(dataset, filters);
  }, [dataset, filters]);

  const handleApplyDataset = (nextBundle: HospitalDatasetBundle) => {
    setDataset(nextBundle);
    setFilters({
      department: 'All',
      startDate: nextBundle.quality.dateRange.min,
      endDate: nextBundle.quality.dateRange.max,
    });
  };

  const handleApplyForecastAction = (action: ForecastAction) => {
    setForecastHorizon(Math.max(7, Math.min(30, action.horizonDays || 14)));
    setForecastMetric(action.metric);
    if (action.department && dataset) {
      const matched =
        action.department.toLowerCase() === 'all'
          ? 'All'
          : dataset.quality.departments.find(
              (d) => d.toLowerCase() === action.department!.toLowerCase()
            );
      if (matched) {
        setFilters((prev) => ({ ...prev, department: matched }));
      }
    }
    setActiveTab('bottlenecks');
  };

  const applyDatePreset = (days: number | 'all') => {
    if (!dataset) return;
    const { min, max } = dataset.quality.dateRange;
    if (days === 'all') {
      setFilters((prev) => ({ ...prev, startDate: min, endDate: max }));
    } else {
      const candidate = shiftIsoDate(max, days - 1);
      setFilters((prev) => ({
        ...prev,
        startDate: candidate < min ? min : candidate,
        endDate: max,
      }));
    }
  };

  if (!dataset || !analytics) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <div className="w-11 h-11 rounded-full bg-[#0A2E36] text-white flex items-center justify-center mx-auto">
            <Activity className="w-5 h-5" />
          </div>
          <div className="font-serif text-xl font-bold text-[#1B1B2F]">
            Parsing Hospital Operations Datasets...
          </div>
          <p className="text-xs italic text-[#6B7280]">
            Validating schemas, mapping columns, and computing baseline metrics
          </p>
        </div>
      </div>
    );
  }

  const dataScopeSummary = `${dataset.quality.dailyRowsParsed.toLocaleString()} daily logs · ${dataset.quality.patientRowsParsed.toLocaleString()} patient encounters · ${dataset.quality.dateRange.min} to ${dataset.quality.dateRange.max}`;

  return (
    <div className="min-h-screen bg-white text-[#1B1B2F] flex flex-col">
      {/* Top Navigation & Brand Bar */}
      <header className="border-b border-[#0A2E36]/12 bg-white sticky top-0 z-30 no-print">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          {/* Left: Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#0A2E36] text-white flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4 text-[#00A795]" />
            </div>
            <div>
              <h1 className="font-serif text-lg sm:text-xl font-bold text-[#1B1B2F] leading-none">
                Meridian Hospital Operations
              </h1>
              <div className="text-[11px] text-[#6B7280] mt-1 font-mono tabular-nums">
                {dataset.quality.departments.length} departments · {dataset.quality.staffRowsParsed} rostered staff · {dataset.quality.sourceMode === 'baseline' ? '2025 Baseline Schema' : 'Uploaded CSVs'}
              </div>
            </div>
          </div>

          {/* Right: 2 Primary Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsDataModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-[6px] border border-[#0A2E36]/20 text-[#1B1B2F] hover:border-[#02808F] hover:text-[#02808F] transition-colors whitespace-nowrap cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              Data &amp; Columns
            </button>
            <button
              type="button"
              onClick={() => setIsChatOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-[6px] bg-[#0A2E36] text-white hover:bg-[#02808F] transition-colors whitespace-nowrap cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5 text-[#00A795]" />
              {isChatOpen ? 'Hide AI Analyst' : 'Ask AI Analyst'}
            </button>
          </div>
        </div>

        {/* Section Tabs Row */}
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 border-t border-[#0A2E36]/8 flex items-center gap-1 overflow-x-auto">
          {NAV_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-xs sm:text-sm font-semibold whitespace-nowrap border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
                  isActive
                    ? 'border-[#02808F] text-[#02808F]'
                    : 'border-transparent text-[#6B7280] hover:text-[#1B1B2F]'
                }`}
              >
                <span className="font-mono text-[11px] tabular-nums">{tab.code}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Global Filter Bar */}
      <div className="border-b border-[#0A2E36]/10 bg-[#0A2E36]/[0.02] no-print">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Department Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-[#02808F]" />
              <label htmlFor="dept-filter" className="text-xs font-semibold text-[#1B1B2F]">
                Department:
              </label>
              <select
                id="dept-filter"
                value={filters.department}
                onChange={(e) => setFilters((prev) => ({ ...prev, department: e.target.value }))}
                className="text-xs px-2.5 py-1.5 rounded-[4px] border border-[#0A2E36]/20 bg-white text-[#1B1B2F] font-medium focus:outline-none focus:border-[#02808F]"
              >
                <option value="All">All Departments ({dataset.quality.departments.length})</option>
                {dataset.quality.departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Inputs */}
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-[#02808F]" />
              <input
                type="date"
                aria-label="Start date"
                value={filters.startDate}
                min={dataset.quality.dateRange.min}
                max={filters.endDate}
                onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                className="text-xs font-mono px-2 py-1 rounded-[4px] border border-[#0A2E36]/20 bg-white text-[#1B1B2F] focus:outline-none focus:border-[#02808F]"
              />
              <span className="text-xs text-[#6B7280]">to</span>
              <input
                type="date"
                aria-label="End date"
                value={filters.endDate}
                min={filters.startDate}
                max={dataset.quality.dateRange.max}
                onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                className="text-xs font-mono px-2 py-1 rounded-[4px] border border-[#0A2E36]/20 bg-white text-[#1B1B2F] focus:outline-none focus:border-[#02808F]"
              />
            </div>

            {/* Quick Presets */}
            <div className="inline-flex rounded-[4px] border border-[#0A2E36]/15 overflow-hidden text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => applyDatePreset('all')}
                className="px-2.5 py-1 bg-white hover:bg-[#02808F]/10 text-[#1B1B2F] cursor-pointer border-r border-[#0A2E36]/15"
              >
                Full Range
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset(90)}
                className="px-2.5 py-1 bg-white hover:bg-[#02808F]/10 text-[#1B1B2F] cursor-pointer border-r border-[#0A2E36]/15"
              >
                90 Days
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset(30)}
                className="px-2.5 py-1 bg-white hover:bg-[#02808F]/10 text-[#1B1B2F] cursor-pointer"
              >
                30 Days
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsDataModalOpen(true)}
            className="text-[11px] font-mono text-[#6B7280] hover:text-[#02808F] flex items-center gap-1.5 cursor-pointer"
          >
            <SlidersHorizontal className="w-3 h-3 text-[#02808F]" />
            <span>
              {dataset.quality.sourceMode === 'baseline'
                ? 'Baseline 2025 CSVs active · Click to upload custom CSVs or remap columns'
                : dataScopeSummary}
            </span>
          </button>
        </div>
      </div>

      {/* Print-Only Header */}
      <div className="hidden print-only px-8 pt-6 pb-4 border-b border-[#0A2E36]/20">
        <div className="text-xs font-mono uppercase tracking-widest text-[#02808F]">
          Meridian Hospital Operations · Executive Print Brief
        </div>
        <div className="text-sm text-[#6B7280] mt-1 font-mono">
          Scope: {filters.department === 'All' ? 'All Departments' : filters.department} · {filters.startDate} to {filters.endDate}
        </div>
      </div>

      {/* Main Content Workspace */}
      <main
        className={`flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-8 py-8 sm:py-10 transition-all ${
          isChatOpen ? 'lg:pr-[424px]' : ''
        }`}
      >
        {analytics.filteredDaily.length === 0 && analytics.filteredPatients.length === 0 ? (
          <div className="border border-[#0A2E36]/15 rounded-[6px] p-10 text-center space-y-3">
            <h2 className="font-serif text-xl font-bold text-[#1B1B2F]">
              No Records Match Active Filters
            </h2>
            <p className="text-sm text-[#6B7280] max-w-md mx-auto">
              Adjust the department filter or date range, or open Data &amp; Columns to upload and map a new hospital CSV dataset.
            </p>
            <button
              type="button"
              onClick={() =>
                setFilters({
                  department: 'All',
                  startDate: dataset.quality.dateRange.min,
                  endDate: dataset.quality.dateRange.max,
                })
              }
              className="px-4 py-2 text-xs font-semibold rounded-[6px] bg-[#02808F] text-white hover:bg-[#0A2E36] cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'insights' && (
              <InsightsDashboardsView
                analytics={analytics}
                filters={filters}
                quality={dataset.quality}
                overtimeRateNgn={overtimeRateNgn}
                onChangeOvertimeRate={setOvertimeRateNgn}
              />
            )}
            {activeTab === 'admissions' && <AdmissionsDemandView analytics={analytics} />}
            {activeTab === 'workload' && <StaffWorkloadView analytics={analytics} />}
            {activeTab === 'bottlenecks' && (
              <BottlenecksForecastingView
                analytics={analytics}
                dailyOps={dataset.dailyOps}
                targets={dataset.targets}
                selectedDepartment={filters.department}
                forecastHorizon={forecastHorizon}
                forecastMetric={forecastMetric}
                onChangeHorizon={setForecastHorizon}
                onChangeMetric={setForecastMetric}
              />
            )}
          </>
        )}
      </main>

      {/* Floating AI Chat Button when collapsed */}
      {!isChatOpen && (
        <button
          type="button"
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2.5 px-4 py-3 rounded-full bg-[#0A2E36] text-white shadow-xl hover:bg-[#02808F] transition-colors cursor-pointer no-print"
          aria-label="Open AI Analytics Assistant"
        >
          <span className="w-7 h-7 rounded-full bg-[#00A795] text-[#0A2E36] flex items-center justify-center">
            <Bot className="w-4 h-4" />
          </span>
          <span className="text-xs font-semibold pr-1">Ask AI Analyst</span>
        </button>
      )}

      {/* Persistent AI Chatbot Drawer */}
      <ChatAssistant
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        analyticsContext={aiSnapshot}
        dataScopeSummary={dataScopeSummary}
        onApplyForecastAction={handleApplyForecastAction}
      />

      {/* CSV Upload & Column Mapping Modal */}
      <DataMappingModal
        isOpen={isDataModalOpen}
        onClose={() => setIsDataModalOpen(false)}
        dataset={dataset}
        onApplyDataset={handleApplyDataset}
      />
    </div>
  );
}
