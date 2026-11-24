import { useState, type ChangeEvent, type DragEvent } from 'react';
import { CheckCircle2, FileSpreadsheet, RotateCcw, Upload, X, AlertCircle } from 'lucide-react';
import type { DatasetRole, HospitalDatasetBundle, UploadedCsvFile } from '../types/hospital';
import {
  DATASET_FIELD_SPECS,
  autoDetectMapping,
  buildHospitalDatasetBundle,
  computeUnmappedRequired,
  loadDefaultBaselineDataset,
  parseRawCsvText,
} from '../utils/dataParser';

interface DataMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  dataset: HospitalDatasetBundle;
  onApplyDataset: (nextBundle: HospitalDatasetBundle) => void;
}

const ROLE_LABELS: Record<DatasetRole, { title: string; subtitle: string }> = {
  dailyOps: {
    title: 'Daily Department Operations',
    subtitle: 'Admissions, handled volume, wait times, bed occupancy & shift staffing',
  },
  targets: {
    title: 'Department Targets',
    subtitle: 'Total bed capacity, shift staffing targets & rostered staff per unit',
  },
  patients: {
    title: 'Patient Encounters',
    subtitle: 'Arrival timestamps (for Day×Hour heatmap), wait time, diagnosis, cost & outcomes',
  },
  staff: {
    title: 'Staff Roster',
    subtitle: 'Clinician roles, employment contracts & years of experience',
  },
};

export function DataMappingModal({
  isOpen,
  onClose,
  dataset,
  onApplyDataset,
}: DataMappingModalProps) {
  const [draftFiles, setDraftFiles] = useState<Record<DatasetRole, UploadedCsvFile | null>>(
    dataset.files
  );
  const [activeRoleTab, setActiveRoleTab] = useState<DatasetRole>('dailyOps');
  const [sourceMode, setSourceMode] = useState<'baseline' | 'uploaded'>(dataset.quality.sourceMode);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  const processFileList = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploadError(null);

    const updated = { ...draftFiles };
    let firstUpdatedRole: DatasetRole | null = null;

    for (const file of Array.from(fileList)) {
      if (!file.name.toLowerCase().endsWith('.csv') && !file.type.includes('csv') && !file.type.includes('text')) {
        setUploadError(`"${file.name}" does not look like a CSV file. Please upload UTF-8 .csv files.`);
        continue;
      }
      const text = await file.text();
      if (!text.trim()) {
        setUploadError(`"${file.name}" is empty.`);
        continue;
      }
      const parsed = parseRawCsvText(file.name, text);
      if (parsed.headers.length === 0 || parsed.rawRows.length === 0) {
        setUploadError(`"${file.name}" contained no readable header/data rows.`);
        continue;
      }
      updated[parsed.role] = parsed;
      if (!firstUpdatedRole) firstUpdatedRole = parsed.role;
    }

    setDraftFiles(updated);
    setSourceMode('uploaded');
    if (firstUpdatedRole) setActiveRoleTab(firstUpdatedRole);
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    void processFileList(e.target.files);
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    void processFileList(e.dataTransfer.files);
  };

  const handleRoleReassign = (fromRole: DatasetRole, toRole: DatasetRole) => {
    if (fromRole === toRole) return;
    const file = draftFiles[fromRole];
    if (!file) return;
    const remapped = autoDetectMapping(toRole, file.headers);
    const updatedFile: UploadedCsvFile = {
      ...file,
      role: toRole,
      mapping: remapped,
      unmappedRequired: computeUnmappedRequired(toRole, remapped),
    };
    setDraftFiles((prev) => ({
      ...prev,
      [fromRole]: null,
      [toRole]: updatedFile,
    }));
    setActiveRoleTab(toRole);
  };

  const handleColumnChange = (role: DatasetRole, canonicalKey: string, csvColumn: string) => {
    const file = draftFiles[role];
    if (!file) return;
    const nextMapping = { ...file.mapping };
    if (!csvColumn) {
      delete nextMapping[canonicalKey];
    } else {
      nextMapping[canonicalKey] = csvColumn;
    }
    setDraftFiles((prev) => ({
      ...prev,
      [role]: {
        ...file,
        mapping: nextMapping,
        unmappedRequired: computeUnmappedRequired(role, nextMapping),
      },
    }));
  };

  const handleResetBaseline = () => {
    const base = loadDefaultBaselineDataset();
    setDraftFiles(base.files);
    setSourceMode('baseline');
    setUploadError(null);
    onApplyDataset(base);
    onClose();
  };

  const handleApply = () => {
    const fileNames = (Object.values(draftFiles).filter(Boolean) as UploadedCsvFile[])
      .map((f) => f.fileName)
      .join(', ');
    const label =
      sourceMode === 'baseline'
        ? 'Baseline 2025 Hospital Schema Dataset (4 CSVs)'
        : `Uploaded CSVs (${fileNames || 'Custom'})`;
    const nextBundle = buildHospitalDatasetBundle(draftFiles, sourceMode, label);
    onApplyDataset(nextBundle);
    onClose();
  };

  const activeFile = draftFiles[activeRoleTab];
  const specs = DATASET_FIELD_SPECS[activeRoleTab];

  return (
    <div className="fixed inset-0 z-50 bg-[#0A2E36]/60 backdrop-blur-[2px] flex items-center justify-center p-4 no-print">
      <div className="bg-white rounded-[8px] border border-[#0A2E36]/20 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-xl">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0A2E36] text-white flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#00A795]">
              CSV Ingestion &amp; Schema Mapper
            </div>
            <h3 className="font-serif text-xl font-bold text-white mt-0.5">
              Dataset Upload &amp; Column Auto-Mapping
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-[6px] p-5 text-center transition-colors ${
              isDragging
                ? 'border-[#00A795] bg-[#00A795]/10'
                : 'border-[#0A2E36]/20 bg-[#0A2E36]/[0.02]'
            }`}
          >
            <Upload className="w-6 h-6 text-[#02808F] mx-auto mb-2" />
            <div className="text-sm font-semibold text-[#1B1B2F]">
              Drop one or multiple hospital CSV files here to replace or update datasets
            </div>
            <p className="text-xs text-[#6B7280] mt-1">
              Columns are auto-detected across Daily Operations, Department Targets, Patient Encounters, and Staff Roster schemas.
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
              <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[6px] bg-[#02808F] text-white text-xs font-semibold hover:bg-[#0A2E36] transition-colors cursor-pointer">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Select CSV File(s)
                <input
                  type="file"
                  accept=".csv,text/csv"
                  multiple
                  onChange={handleFileInput}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={handleResetBaseline}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[6px] border border-[#0A2E36]/20 text-xs font-semibold text-[#1B1B2F] hover:border-[#02808F] hover:text-[#02808F] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset to 2025 Baseline CSVs
              </button>
            </div>
            {uploadError && (
              <div className="mt-3 text-xs text-[#0A2E36] font-medium flex items-center justify-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-[#02808F]" />
                {uploadError}
              </div>
            )}
          </div>

          {/* Dataset Role Selector Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['dailyOps', 'targets', 'patients', 'staff'] as DatasetRole[]).map((role) => {
              const file = draftFiles[role];
              const isSelected = activeRoleTab === role;
              return (
                <button
                  type="button"
                  key={role}
                  onClick={() => setActiveRoleTab(role)}
                  className={`p-3 rounded-[6px] border text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-[#02808F] bg-[#02808F]/8'
                      : 'border-[#0A2E36]/15 hover:border-[#02808F]/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-[#1B1B2F] truncate">
                      {ROLE_LABELS[role].title}
                    </span>
                    {file ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#00A795] shrink-0" />
                    ) : null}
                  </div>
                  <div className="text-[11px] font-mono text-[#6B7280] mt-1 tabular-nums truncate">
                    {file ? `${file.rawRows.length.toLocaleString()} rows` : 'Not loaded'}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Dataset Column Mapping Table */}
          <div className="border border-[#0A2E36]/15 rounded-[6px] overflow-hidden">
            <div className="px-4 py-3 bg-[#0A2E36]/[0.03] border-b border-[#0A2E36]/12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="text-sm font-bold text-[#1B1B2F]">
                  {ROLE_LABELS[activeRoleTab].title}
                  {activeFile ? (
                    <span className="ml-2 font-mono text-xs font-normal text-[#02808F]">
                      ({activeFile.fileName})
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-[#6B7280]">{ROLE_LABELS[activeRoleTab].subtitle}</div>
              </div>
              {activeFile && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-[#6B7280]">Assign as:</span>
                  <select
                    value={activeRoleTab}
                    onChange={(e) => handleRoleReassign(activeRoleTab, e.target.value as DatasetRole)}
                    className="px-2 py-1 border border-[#0A2E36]/20 rounded-[4px] bg-white text-[#1B1B2F] font-medium"
                  >
                    <option value="dailyOps">Daily Operations</option>
                    <option value="targets">Department Targets</option>
                    <option value="patients">Patient Encounters</option>
                    <option value="staff">Staff Roster</option>
                  </select>
                </div>
              )}
            </div>

            {!activeFile ? (
              <div className="p-6 text-center text-sm text-[#6B7280]">
                No CSV currently assigned to {ROLE_LABELS[activeRoleTab].title}. Upload a CSV above to map its columns.
              </div>
            ) : (
              <div className="p-4">
                {activeFile.unmappedRequired.length > 0 && (
                  <div className="mb-4 p-3 rounded-[4px] bg-[#02808F]/10 text-xs text-[#0A2E36]">
                    Missing required mapping(s):{' '}
                    <span className="font-semibold">{activeFile.unmappedRequired.join(', ')}</span>. Select matching CSV columns below.
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {specs.map((spec) => {
                    const mappedValue = activeFile.mapping[spec.key] || '';
                    return (
                      <div
                        key={spec.key}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-[4px] border border-[#0A2E36]/12"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#1B1B2F] truncate">
                            {spec.label}
                            {spec.required ? <span className="text-[#02808F] ml-1">*</span> : null}
                          </div>
                          <div className="text-[10px] font-mono text-[#6B7280] truncate">{spec.key}</div>
                        </div>
                        <select
                          value={mappedValue}
                          onChange={(e) => handleColumnChange(activeRoleTab, spec.key, e.target.value)}
                          className="w-44 text-xs px-2 py-1.5 border border-[#0A2E36]/20 rounded-[4px] bg-white text-[#1B1B2F] font-mono"
                        >
                          <option value="">— Unmapped —</option>
                          {activeFile.headers.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#0A2E36]/12 bg-[#0A2E36]/[0.02] flex items-center justify-between gap-3">
          <div className="text-xs text-[#6B7280]">
            Active mode:{' '}
            <span className="font-semibold text-[#1B1B2F]">
              {sourceMode === 'baseline' ? '2025 Baseline Schema Dataset' : 'Custom Uploaded CSVs'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-[6px] border border-[#0A2E36]/20 text-[#1B1B2F] hover:border-[#0A2E36] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-2 text-xs font-semibold rounded-[6px] bg-[#02808F] text-white hover:bg-[#0A2E36] transition-colors cursor-pointer"
            >
              Apply Schema &amp; Refresh Analytics
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
