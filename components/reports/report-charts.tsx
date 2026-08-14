"use client";

import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { formatMoney } from "@/lib/utils";
import type { PeriodSalesPoint, ItemRanking } from "@/types/interfaces";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

/** First color = brand primary; curated palette then unlimited HSL hues. */
const PRIMARY_CHART_COLOR = "#2EF2C5";
const CURATED_ITEM_COLORS = [
  "#FBBF24", // amber
  "#38BDF8", // sky
  "#A78BFA", // violet
  "#F472B6", // pink
  "#FB923C", // orange
  "#4ADE80", // green
  "#F87171", // red
  "#22D3EE", // cyan
  "#E879F9", // fuchsia
  "#84CC16", // lime
  "#818CF8", // indigo
];

function itemChartColor(index: number): string {
  if (index === 0) return PRIMARY_CHART_COLOR;
  const curatedIndex = index - 1;
  if (curatedIndex < CURATED_ITEM_COLORS.length)
    return CURATED_ITEM_COLORS[curatedIndex];

  // Beyond curated list: golden-angle hues so colors stay distinct forever
  const overflow = curatedIndex - CURATED_ITEM_COLORS.length;
  const hue = (overflow * 137.508) % 360;
  const lightness = 58 + (overflow % 3) * 6;
  return `hsl(${hue.toFixed(1)} 78% ${lightness}%)`;
}

function itemChartColors(count: number): string[] {
  return Array.from({ length: count }, (_, index) => itemChartColor(index));
}

interface SalesPeriodChartProps {
  points: PeriodSalesPoint[];
  currency: string;
}

export function SalesPeriodChart({ points, currency }: SalesPeriodChartProps) {
  const categories = points.map((point) => point.label);
  const totals = points.map((point) => Number(point.total.toFixed(2)));

  const options: ApexOptions = {
    chart: {
      type: "area",
      toolbar: { show: false },
      zoom: { enabled: false },
      background: "transparent",
      fontFamily: "inherit",
    },
    theme: { mode: "dark" },
    colors: [PRIMARY_CHART_COLOR],
    dataLabels: { enabled: false },
    stroke: { curve: "smooth", width: 2 },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 0.4,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [0, 90, 100],
      },
    },
    grid: {
      borderColor: "rgba(255,255,255,0.08)",
      strokeDashArray: 4,
    },
    xaxis: {
      categories,
      labels: { style: { colors: "#9CA3AF", fontSize: "11px" } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: "#9CA3AF", fontSize: "11px" },
        formatter: (value) => formatMoney(value, currency),
      },
    },
    tooltip: {
      theme: "dark",
      y: {
        formatter: (value) => formatMoney(Number(value), currency),
      },
    },
  };

  if (points.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        No paid sales in range.
      </div>
    );
  }

  return (
    <ReactApexChart
      type="area"
      height={280}
      series={[{ name: "Sales", data: totals }]}
      options={options}
    />
  );
}

interface TopItemsChartProps {
  items: ItemRanking[];
  currency: string;
}

export function TopItemsChart({ items, currency }: TopItemsChartProps) {
  const slice = items.slice(0, 10);
  const labels = slice.map((item) => item.name);
  const series = slice.map((item) => Number(item.revenue.toFixed(2)));
  const colors = itemChartColors(slice.length);

  const options: ApexOptions = {
    chart: {
      type: "donut",
      background: "transparent",
      fontFamily: "inherit",
    },
    theme: { mode: "dark" },
    colors,
    labels,
    legend: {
      position: "bottom",
      labels: { colors: "#D1D5DB" },
      fontSize: "12px",
      markers: {
        fillColors: colors,
      },
    },
    dataLabels: { enabled: false },
    stroke: { width: 0 },
    plotOptions: {
      pie: {
        donut: {
          size: "68%",
          labels: {
            show: true,
            total: {
              show: true,
              label: "Revenue",
              color: "#9CA3AF",
              formatter: () =>
                formatMoney(
                  series.reduce((sum, value) => sum + value, 0),
                  currency,
                ),
            },
            value: {
              color: "#F9FAFB",
              formatter: (value) => formatMoney(Number(value), currency),
            },
          },
        },
      },
    },
    tooltip: {
      theme: "dark",
      y: {
        formatter: (value) => formatMoney(Number(value), currency),
      },
    },
  };

  if (slice.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        No item sales in range.
      </div>
    );
  }

  return (
    <ReactApexChart
      type="donut"
      height={280}
      series={series}
      options={options}
    />
  );
}
