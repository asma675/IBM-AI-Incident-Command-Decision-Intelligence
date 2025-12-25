import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { appClient } from "@/api/appClient";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts";
import { TrendingUp, Clock, AlertTriangle, CheckCircle2, FileText, Sparkles, Download, Filter, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import MetricCard from "@/components/dashboard/MetricCard";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, differenceInHours, differenceInMinutes } from "date-fns";

const COLORS = {
  critical: "#f43f5e",
  high: "#f59e0b",
  medium: "#0ea5e9",
  low: "#94a3b8"
};

const STATUS_COLORS = {
  new: "#6366f1",
  analyzing: "#8b5cf6",
  awaiting_approval: "#f59e0b",
  in_progress: "#0ea5e9",
  resolved: "#10b981",
  closed: "#64748b"
};

export default function Analytics() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [systemFilter, setSystemFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  
  const { data: allIncidents = [], isLoading } = useQuery({
    queryKey: ["analyticsIncidents"],
    queryFn: () => appClient.entities.Incident.list("-created_date", 200)
  });
  
  const { data: reviews = [] } = useQuery({
    queryKey: ["postIncidentReviews"],
    queryFn: () => appClient.entities.PostIncidentReview.list("-created_date", 10),
  });
  
  // Get all unique systems
  const allSystems = [...new Set(allIncidents.flatMap(i => i.affected_systems || []))].sort();
  
  // Apply filters
  const incidents = allIncidents.filter(incident => {
    const matchesStatus = statusFilter === "all" || incident.status === statusFilter;
    const matchesSeverity = severityFilter === "all" || incident.severity === severityFilter;
    const matchesSystem = systemFilter === "all" || incident.affected_systems?.includes(systemFilter);
    
    let matchesDate = true;
    if (dateRange !== "all") {
      const incidentDate = new Date(incident.created_date);
      const now = new Date();
      const daysAgo = new Date();
      
      switch(dateRange) {
        case "7d":
          daysAgo.setDate(now.getDate() - 7);
          matchesDate = incidentDate >= daysAgo;
          break;
        case "30d":
          daysAgo.setDate(now.getDate() - 30);
          matchesDate = incidentDate >= daysAgo;
          break;
        case "90d":
          daysAgo.setDate(now.getDate() - 90);
          matchesDate = incidentDate >= daysAgo;
          break;
      }
    }
    
    return matchesStatus && matchesSeverity && matchesSystem && matchesDate;
  });
  
  // Severity distribution
  const severityData = ["critical", "high", "medium", "low"].map(severity => ({
    name: severity.charAt(0).toUpperCase() + severity.slice(1),
    value: incidents.filter(i => i.severity === severity).length,
    color: COLORS[severity]
  })).filter(d => d.value > 0);
  
  // Status distribution
  const statusData = Object.entries(STATUS_COLORS).map(([status, color]) => ({
    name: status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
    value: incidents.filter(i => i.status === status).length,
    color
  })).filter(d => d.value > 0);
  
  // AI confidence distribution
  const confidenceBuckets = [
    { range: "90-100%", min: 0.9, max: 1, count: 0 },
    { range: "70-89%", min: 0.7, max: 0.89, count: 0 },
    { range: "50-69%", min: 0.5, max: 0.69, count: 0 },
    { range: "0-49%", min: 0, max: 0.49, count: 0 }
  ];
  
  incidents.forEach(incident => {
    const conf = incident.ai_analysis?.confidence_score;
    if (conf !== undefined) {
      const bucket = confidenceBuckets.find(b => conf >= b.min && conf <= b.max);
      if (bucket) bucket.count++;
    }
  });
  
  // Source distribution
  const sourceMap = {};
  incidents.forEach(i => {
    if (i.source) {
      sourceMap[i.source] = (sourceMap[i.source] || 0) + 1;
    }
  });
  const sourceData = Object.entries(sourceMap)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }));
  
  // Weekly trend (last 4 weeks)
  const weeklyData = [];
  for (let i = 3; i >= 0; i--) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - (i * 7 + 7));
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() - (i * 7));
    
    const weekIncidents = incidents.filter(inc => {
      const date = new Date(inc.created_date);
      return date >= weekStart && date < weekEnd;
    });
    
    weeklyData.push({
      week: `Week ${4 - i}`,
      total: weekIncidents.length,
      critical: weekIncidents.filter(i => i.severity === "critical").length,
      resolved: weekIncidents.filter(i => i.status === "resolved" || i.status === "closed").length
    });
  }
  
  const avgConfidence = incidents
    .filter(i => i.ai_analysis?.confidence_score)
    .reduce((sum, i) => sum + i.ai_analysis.confidence_score, 0) / 
    incidents.filter(i => i.ai_analysis?.confidence_score).length * 100 || 0;
  
  const resolvedIncidents = incidents.filter(i => i.status === "resolved" || i.status === "closed");
  
  // Calculate resolution time metrics
  const resolutionTimes = resolvedIncidents
    .filter(i => i.resolved_at)
    .map(i => {
      const created = new Date(i.created_date);
      const resolved = new Date(i.resolved_at);
      return differenceInMinutes(resolved, created);
    });
  
  const avgResolutionTime = resolutionTimes.length > 0 
    ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length 
    : 0;
  
  // Resolution time distribution
  const resolutionTimeData = [
    { range: "< 1hr", count: resolutionTimes.filter(t => t < 60).length },
    { range: "1-4hrs", count: resolutionTimes.filter(t => t >= 60 && t < 240).length },
    { range: "4-24hrs", count: resolutionTimes.filter(t => t >= 240 && t < 1440).length },
    { range: "> 24hrs", count: resolutionTimes.filter(t => t >= 1440).length }
  ];
  
  const formatResolutionTime = (minutes) => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };
  
  // Export report function
  const exportReport = () => {
    const reportData = {
      generated_at: new Date().toISOString(),
      filters: { status: statusFilter, severity: severityFilter, system: systemFilter, dateRange },
      metrics: {
        total_incidents: incidents.length,
        resolution_rate: incidents.length > 0 ? (resolvedIncidents.length / incidents.length * 100).toFixed(2) : 0,
        avg_ai_confidence: avgConfidence.toFixed(2),
        avg_resolution_time_minutes: avgResolutionTime.toFixed(2)
      },
      severity_distribution: severityData,
      status_distribution: statusData,
      incidents: incidents.map(i => ({
        id: i.id,
        title: i.title,
        severity: i.severity,
        status: i.status,
        created_date: i.created_date,
        resolved_at: i.resolved_at,
        affected_systems: i.affected_systems
      }))
    };
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incident-report-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
  };
  
  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-white tracking-tight flex items-center gap-3">
                <TrendingUp className="h-7 w-7 text-blue-600" />
                Analytics & Reports
              </h1>
              <p className="text-slate-400 mt-1">
                Custom reporting with advanced metrics and visualizations
              </p>
            </div>
            <Button onClick={exportReport} className="bg-blue-600 hover:bg-blue-700">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>
        
        {/* Filters */}
        <Card className="bg-slate-900 border-slate-800 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Report Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-slate-400 mb-2 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="analyzing">Analyzing</SelectItem>
                    <SelectItem value="awaiting_approval">Awaiting Approval</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-xs text-slate-400 mb-2 block">Severity</label>
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severity</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-xs text-slate-400 mb-2 block">Affected System</label>
                <Select value={systemFilter} onValueChange={setSystemFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Systems</SelectItem>
                    {allSystems.map(sys => (
                      <SelectItem key={sys} value={sys}>{sys}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-xs text-slate-400 mb-2 block">Date Range</label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="30d">Last 30 Days</SelectItem>
                    <SelectItem value="90d">Last 90 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {(statusFilter !== "all" || severityFilter !== "all" || systemFilter !== "all" || dateRange !== "all") && (
              <div className="mt-4 flex items-center gap-2">
                <span className="text-sm text-slate-400">
                  Showing {incidents.length} of {allIncidents.length} incidents
                </span>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setStatusFilter("all");
                    setSeverityFilter("all");
                    setSystemFilter("all");
                    setDateRange("all");
                  }}
                  className="text-blue-400 hover:text-blue-300"
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Recent Post-Incident Reviews */}
        {reviews.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-400" />
                Recent Post-Incident Reviews
              </h2>
            </div>
            <div className="space-y-3">
              {reviews.slice(0, 3).map(review => (
                <Link 
                  key={review.id} 
                  to={createPageUrl(`IncidentDetail?id=${review.incident_id}`)}
                  className="block"
                >
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:shadow-xl hover:shadow-blue-600/10 transition-all">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-blue-400" />
                          <span className="text-sm font-medium text-white">
                            Review for Incident #{review.incident_id.slice(0, 8)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400 line-clamp-2">
                          {review.executive_summary}
                        </p>
                        {review.key_learnings?.length > 0 && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-slate-500">
                              {review.key_learnings.length} key learnings
                            </span>
                            <span className="text-slate-700">•</span>
                            <span className="text-xs text-slate-500">
                              {review.follow_up_actions?.length || 0} follow-up actions
                            </span>
                          </div>
                        )}
                      </div>
                      {review.confidence_score && (
                        <div className="text-right">
                          <div className="text-xs text-slate-500 mb-1">Confidence</div>
                          <div className="text-lg font-semibold text-blue-400">
                            {Math.round(review.confidence_score * 100)}%
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
        
        {/* Top Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            title="Total Incidents"
            value={incidents.length}
            icon={AlertTriangle}
          />
          <MetricCard
            title="Resolution Rate"
            value={`${incidents.length > 0 ? Math.round(resolvedIncidents.length / incidents.length * 100) : 0}%`}
            icon={CheckCircle2}
          />
          <MetricCard
            title="Avg AI Confidence"
            value={`${avgConfidence.toFixed(0)}%`}
            icon={TrendingUp}
          />
          <MetricCard
            title="Avg Resolution Time"
            value={avgResolutionTime > 0 ? formatResolutionTime(avgResolutionTime) : "N/A"}
            icon={Clock}
            subtext={resolvedIncidents.length > 0 ? `${resolvedIncidents.length} resolved` : "No resolutions"}
          />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Severity Distribution */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Severity Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={severityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {severityData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          {/* Status Distribution */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Weekly Trend */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Weekly Incident Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="total" name="Total" stroke="#6366f1" strokeWidth={2} />
                    <Line type="monotone" dataKey="critical" name="Critical" stroke="#f43f5e" strokeWidth={2} />
                    <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#10b981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          {/* AI Confidence Distribution */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">AI Confidence Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={confidenceBuckets}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="range" tick={{ fontSize: 12, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                    <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          {/* Resolution Time Distribution */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Resolution Time Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={resolutionTimeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="range" tick={{ fontSize: 12, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                    <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Alert Sources */}
        {sourceData.length > 0 && (
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Incidents by Source</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sourceData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={100} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}