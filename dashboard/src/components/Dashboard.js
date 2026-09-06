import React from "react";
import { Route, Routes } from "react-router-dom";

import Apps from "./Apps";
import Funds from "./Funds";
import Holdings from "./Holdings";
import Orders from "./Orders";
import Positions from "./Positions";
import Summary from "./Summary";
import WatchList from "./WatchList";
import Trades from "./Trades";
import StockDetail from "./StockDetail";
import ExploreStocks from "./ExploreStocks";
import { GeneralContextProvider } from "./GeneralContext";

const Dashboard = () => {
  return (
    <div className="dashboard-container">
      <GeneralContextProvider>
        <WatchList />
        <div className="content">
          <Routes>
            <Route exact path="/" element={<Summary />} />
            <Route path="/explore" element={<ExploreStocks />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/trades" element={<Trades />} />
            <Route path="/holdings" element={<Holdings />} />
            <Route path="/positions" element={<Positions />} />
            <Route path="/funds" element={<Funds />} />
            <Route path="/apps" element={<Apps />} />
            <Route path="/stock/:symbol" element={<StockDetail />} />
          </Routes>
        </div>
      </GeneralContextProvider>
    </div>
  );
};

export default Dashboard;
