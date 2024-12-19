import React, { useState, useEffect, useCallback } from "react";
import { Button, Typography, Divider } from "@mui/material";
import {
  Save as SaveIcon,
  Delete,
  CalendarMonthTwoTone,
  CopyAll,
  ImportExport,
  PlayCircle,
} from "@mui/icons-material";
import { useForm, useWatch } from "react-hook-form";
import { debounce } from "lodash";
import CippButtonCard from "/src/components/CippCards/CippButtonCard";
import CippFormComponent from "/src/components/CippComponents/CippFormComponent";
import { ApiGetCall, ApiPostCall } from "../../api/ApiCall";
import { useSettings } from "../../hooks/use-settings";
import { CippApiResults } from "../CippComponents/CippApiResults";
import { CippFormCondition } from "../CippComponents/CippFormCondition";
import { CippOffCanvas } from "../CippComponents/CippOffCanvas";
import { CippCodeBlock } from "../CippComponents/CippCodeBlock";
import CippSchedulerForm from "../CippFormPages/CippSchedulerForm";
import defaultPresets from "../../data/GraphExplorerPresets";
import { lighten, darken, styled, Grid, Stack } from "@mui/system";

const GroupHeader = styled("div")(({ theme }) => ({
  position: "sticky",
  top: "-8px",
  padding: "4px 10px",
  color: theme.palette.primary.main,
  backgroundColor: lighten(theme.palette.primary.light, 0.85),
  ...theme.applyStyles("dark", {
    backgroundColor: darken(theme.palette.primary.main, 0.8),
  }),
}));

const GroupItems = styled("ul")({
  padding: 0,
});

const CippGraphExplorerFilter = ({ endpointFilter, onSubmitFilter, component = "accordion" }) => {
  const [offCanvasOpen, setOffCanvasOpen] = useState(false);
  const [cardExpanded, setCardExpanded] = useState(true);
  const [offCanvasContent, setOffCanvasContent] = useState(null);
  const [selectedPresetState, setSelectedPreset] = useState(null);
  const [presetOwner, setPresetOwner] = useState(false);
  const [presetOptions, setPresetOptions] = useState([]);
  const formControl = useForm({
    mode: "onChange",
    defaultValues: {
      endpoint: "",
      $select: "",
      NoPagination: false,
      ReverseTenantLookup: false,
      ReverseTenantLookupProperty: "tenantId",
      $count: false,
      manualPagination: false,
      IsShared: false,
    },
  });

  var gridContainerSize = 6;
  if (component !== "accordion") {
    gridContainerSize = 12;
  }

  var gridSwitchSize = 3;
  if (component !== "accordion") {
    gridSwitchSize = 12;
  }

  const { control, handleSubmit, watch } = formControl;
  const tenant = useSettings().currentTenant;
  const endPoint = useWatch({ control, name: "endpoint" });

  // API call for available properties
  const propertyList = ApiGetCall({
    url: "/api/ListGraphRequest",
    queryKey: `graph-properties-${endPoint}`,
    data: {
      Endpoint: endPoint,
      ListProperties: true,
      TenantFilter: tenant,
      IgnoreErrors: true,
    },
    waiting: false,
  });

  var presetFilter = {};
  if (endpointFilter) {
    if (formControl.getValues("endpoint") !== endpointFilter) {
      formControl.setValue("endpoint", endpointFilter);
    }
    presetFilter = { Endpoint: endpointFilter };
  }

  // API call for available presets
  const presetList = ApiGetCall({
    url: "/api/ListGraphExplorerPresets",
    queryKey: "ListGraphExplorerPresets",
    data: presetFilter,
  });

  useEffect(() => {
    var presetOptionList = [];
    const normalizeEndpoint = (endpoint) => endpoint.replace(/^\//, "");
    console.log("defaultPresets", defaultPresets);
    defaultPresets
      .filter(
        (item) =>
          !endpointFilter ||
          normalizeEndpoint(item.params.endpoint) === normalizeEndpoint(endpointFilter)
      )
      .forEach((item) => {
        presetOptionList.push({
          label: item.name,
          value: item.id,
          addedFields: item,
          type: "Built-In",
        });
      });
    if (presetList.isSuccess && presetList.data?.Results.length > 0) {
      presetList.data.Results.forEach((item) => {
        presetOptionList.push({
          label: item.name,
          value: item.id,
          addedFields: item,
          type: "Custom",
        });
      });
    }
    setPresetOptions(presetOptionList);
  }, [defaultPresets, presetList.isSuccess]);

  // Debounced refetch when endpoint, put in in a useEffect dependand on endpoint
  const debouncedRefetch = useCallback(
    debounce(() => {
      if (endPoint) {
        propertyList.refetch();
      }
    }, 1000),
    [endPoint] // Dependencies that the debounce function depends on
  );

  useEffect(() => {
    debouncedRefetch();
    // Clean up the debounce on unmount
    return () => {
      debouncedRefetch.cancel();
    };
  }, [endPoint, debouncedRefetch]);

  const savePresetApi = ApiPostCall({
    relatedQueryKeys: "ListGraphExplorerPresets",
  });

  // Save preset function
  const handleSavePreset = () => {
    const currentTemplate = formControl.getValues();
    if (!presetOwner && currentTemplate?.id) {
      delete currentTemplate.id;
    }
    savePresetApi.mutate({
      url: "/api/ExecGraphExplorerPreset",
      data: { action: presetOwner ? "Save" : "Copy", preset: currentTemplate },
    });
  };

  const selectedPresets = useWatch({ control, name: "reportTemplate" });
  useEffect(() => {
    if (selectedPresets?.addedFields?.params) {
      setPresetOwner(selectedPresets?.addedFields?.IsMyPreset ?? false);
      Object.keys(selectedPresets.addedFields.params).forEach(
        (key) =>
          selectedPresets.addedFields.params[key] == null &&
          delete selectedPresets.addedFields.params[key]
      );
      //if $select is a blank array, set it to a string.
      if (
        selectedPresets.addedFields.params.$select &&
        selectedPresets.addedFields.params.$select.length === 0
      ) {
        selectedPresets.addedFields.params.$select = "";
      }

      // if $select is an array, extract the values and comma separate
      if (
        Array.isArray(selectedPresets.addedFields.params.$select) &&
        selectedPresets.addedFields.params.$select.length > 0
      ) {
        selectedPresets.addedFields.params.$select = selectedPresets.addedFields.params.$select
          .map((item) => item.value)
          .join(",");
      }
      selectedPresets.addedFields.params.$select !== ""
        ? (selectedPresets.addedFields.params.$select = selectedPresets.addedFields.params?.$select
            ?.split(",")
            .map((item) => ({ label: item, value: item })))
        : (selectedPresets.addedFields.params.$select = []);
      selectedPresets.addedFields.params.id = selectedPresets.value;
      setSelectedPreset(selectedPresets.value);
      selectedPresets.addedFields.params.name = selectedPresets.label;

      formControl.reset(selectedPresets?.addedFields?.params, { keepDefaultValues: true });
    }
  }, [selectedPresets]);

  const schedulerForm = useForm({
    mode: "onChange",
  });

  const schedulerCommand = {
    Function: "Get-GraphRequestList",
    Synopsis: "Execute a Graph query",
    Parameters: [
      {
        Name: "Endpoint",
        Type: "System.String",
        Description: "Graph API endpoint",
        Required: true,
      },
      {
        Name: "Parameters",
        Type: "System.Collections.Hashtable",
        Description: "API Parameters",
        Required: false,
      },
      {
        Name: "queueId",
        Type: "System.String",
        Description: "Queue Id",
        Required: false,
      },
      {
        Name: "NoPagination",
        Type: "System.Management.Automation.SwitchParameter",
        Description: "Disable pagination",
        Required: false,
      },
      {
        Name: "CountOnly",
        Type: "System.Management.Automation.SwitchParameter",
        Description: "Only return count of results",
        Required: false,
      },
      {
        Name: "ReverseTenantLookup",
        Type: "System.Management.Automation.SwitchParameter",
        Description: "Perform reverse tenant lookup",
        Required: false,
      },
      {
        Name: "ReverseTenantLookupProperty",
        Type: "System.String",
        Description: "Property to perform reverse tenant lookup",
        Required: false,
      },
      {
        Name: "AsApp",
        Type: "System.Boolean",
        Description: null,
        Required: false,
      },
    ],
  };
  // Schedule report function
  const handleScheduleReport = () => {
    const formParameters = formControl.getValues();
    const selectString = formParameters.$select
      ? formParameters.$select?.map((item) => item.value).join(",")
      : null;

    //compose the parameters for the form based on what is available
    const Parameters = [
      {
        Key: "$select",
        Value: selectString,
      },
      {
        Key: "$filter",
        Value: formParameters.$filter,
      },
      {
        Key: "$top",
        Value: formParameters.$top,
      },
      {
        Key: "$search",
        Value: formParameters.$search,
      },
      {
        Key: "$count",
        Value: formParameters.$count,
      },
    ];
    Parameters.forEach((param) => {
      if (param.Value == null || param.Value === "") {
        //delete the index
        Parameters.splice(Parameters.indexOf(param), 1);
      }
    });
    const resetParams = {
      tenantFilter: tenant,
      Name: formParameters.name
        ? `Graph Explorer - ${formParameters.name}`
        : "Graph Explorer Report",
      command: {
        label: schedulerCommand.Function,
        value: schedulerCommand.Function,
        addedFields: schedulerCommand,
      },
      parameters: {
        Endpoint: formParameters.endpoint,
        skipCache: true,
        NoPagination: formParameters.NoPagination,
        Parameters: Parameters,
      },
      advancedParameters: false,
      Recurrence: {
        value: 0,
        label: "Only once",
      },
    };
    schedulerForm.reset(resetParams);
    setOffCanvasContent(
      <>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Schedule Graph Explorer Report
        </Typography>
        <CippSchedulerForm fullWidth formControl={schedulerForm} />
      </>
    );
    setOffCanvasOpen(true);
  };

  const [editorValues, setEditorValues] = useState({});
  //keep the editor in sync with the form

  function getPresetProps(values) {
    var newvals = Object.assign({}, values);
    if (newvals?.$select !== undefined && Array.isArray(newvals?.$select)) {
      newvals.$select = newvals?.$select.map((p) => p.value).join(",");
    }
    delete newvals["reportTemplate"];
    delete newvals["tenantFilter"];
    delete newvals["IsShared"];
    if (newvals.ReverseTenantLookup === false) {
      delete newvals.ReverseTenantLookup;
    }
    if (newvals.NoPagination === false) {
      delete newvals.NoPagination;
    }
    if (newvals.$count === false) {
      delete newvals.$count;
    }
    Object.keys(newvals).forEach((key) => {
      if (values[key] === "" || values[key] === null) {
        delete newvals[key];
      }
    });
    return newvals;
  }

  useEffect(() => {
    var values = getPresetProps(formControl.getValues());
    setOffCanvasContent(() => (
      <>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Import / Export Graph Explorer Preset
        </Typography>
        <CippCodeBlock
          type="editor"
          onChange={(value) => setEditorValues(JSON.parse(value))}
          code={JSON.stringify(values, null, 2)}
        />
        <Button
          onClick={() => {
            savePresetApi.mutate({
              url: "/api/ExecGraphExplorerPreset",
              data: { action: "Copy", preset: editorValues },
            });
          }}
          variant="contained"
          color="primary"
        >
          Import Template
        </Button>
        <CippApiResults apiObject={savePresetApi} />
      </>
    ));
  }, [editorValues, savePresetApi.isPending, formControl, selectedPresets]);

  const handleImport = () => {
    setOffCanvasOpen(true); // Open the offCanvas, the content will be updated by useEffect
  };
  // Handle filter form submission
  const onSubmit = (values) => {
    if (values.$select && Array.isArray(values.$select) && values.$select.length > 0) {
      values.$select = values?.$select?.map((item) => item.value)?.join(",");
    }
    if (values.ReverseTenantLookup === false) {
      delete values.ReverseTenantLookup;
    }
    if (values.NoPagination === false) {
      delete values.NoPagination;
    }
    if (values.$count === false) {
      delete values.$count;
    }
    onSubmitFilter(values);
    setCardExpanded(false);
  };

  const deletePreset = (id) => {
    savePresetApi.mutate({
      url: "/api/ExecGraphExplorerPreset",
      data: { action: "Delete", preset: { id: selectedPresetState } },
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <CippButtonCard
        title="Graph Explorer Filter"
        component={component}
        accordionExpanded={cardExpanded}
        cardSx={{ width: "100%", height: "100%" }}
      >
        <Grid container spacing={2}>
          <Grid container item size={{ xs: 12, sm: gridContainerSize }} spacing={2}>
            <Grid item size={12}>
              <CippFormComponent
                type="autoComplete"
                name="reportTemplate"
                label="Select a Report Preset"
                multiple={false}
                formControl={formControl}
                options={presetOptions}
                groupBy={(option) => option.type}
                renderGroup={(params) => (
                  <li key={params.key}>
                    <GroupHeader>{params.group}</GroupHeader>
                    <GroupItems>{params.children}</GroupItems>
                  </li>
                )}
                placeholder="Select a preset"
              />
            </Grid>
            <Grid item size={12}>
              <CippFormComponent
                type="textField"
                name="endpoint"
                label="Endpoint"
                formControl={formControl}
                disabled={endpointFilter ? true : false}
                placeholder="Enter Graph API endpoint"
              />
            </Grid>

            <Grid item size={12}>
              <CippFormComponent
                type="autoComplete"
                name="$select"
                label="Select"
                formControl={formControl}
                isFetching={propertyList.isLoading}
                options={
                  (propertyList.isSuccess &&
                    propertyList?.data?.Results?.map((item) => ({ label: item, value: item }))) ||
                  []
                }
                placeholder="Columns to select"
                helperText="Comma-separated list of columns to include in the response"
              />
            </Grid>

            {/* Expand Field */}
            <Grid item size={12}>
              <CippFormComponent
                type="textField"
                name="$expand"
                label="Expand"
                formControl={formControl}
                placeholder="Expand related entities"
              />
            </Grid>
          </Grid>

          {/* Right Column */}
          <Grid container item size={{ xs: 12, sm: gridContainerSize }} spacing={2}>
            {/* Preset Name Field */}
            <Grid item size={12}>
              <CippFormComponent
                type="textField"
                name="name"
                label="Preset Name"
                formControl={formControl}
                placeholder="Name for this filter preset"
              />
            </Grid>

            {/* Filter Field */}
            <Grid item size={12}>
              <CippFormComponent
                type="textField"
                name="$filter"
                label="Filter"
                formControl={formControl}
                placeholder="OData filter"
              />
            </Grid>

            {/* Top Field */}
            <Grid item size={12}>
              <CippFormComponent
                type="number"
                fullWidth
                name="$top"
                label="Top"
                formControl={formControl}
                placeholder="Number of records to return"
              />
            </Grid>

            {/* Search Field */}
            <Grid item size={12}>
              <CippFormComponent
                type="textField"
                name="$search"
                label="Search"
                formControl={formControl}
                placeholder="Search query"
              />
            </Grid>
          </Grid>

          {/* Reverse Tenant Lookup Switch */}
          <Grid item size={{ xs: 12, sm: gridSwitchSize }}>
            <CippFormComponent
              type="switch"
              name="ReverseTenantLookup"
              label="Reverse Tenant Lookup"
              formControl={formControl}
            />
          </Grid>
          <CippFormCondition
            formControl={formControl}
            field={"ReverseTenantLookup"}
            compareValue={true}
          >
            {/* Reverse Tenant Lookup Property Field */}
            <Grid item size={12}>
              <CippFormComponent
                type="textField"
                name="ReverseTenantLookupProperty"
                label="Reverse Tenant Lookup Property"
                formControl={formControl}
                placeholder="Enter the reverse tenant lookup property (e.g. tenantId)"
              />
            </Grid>
          </CippFormCondition>

          {/* No Pagination Switch */}
          <Grid item size={{ xs: 12, sm: gridSwitchSize }}>
            <CippFormComponent
              type="switch"
              name="NoPagination"
              label="Disable Pagination"
              formControl={formControl}
            />
          </Grid>

          {/* $count Switch */}
          <Grid item size={{ xs: 12, sm: gridSwitchSize }}>
            <CippFormComponent
              type="switch"
              name="$count"
              label="Use $count"
              formControl={formControl}
            />
          </Grid>
          {/* AsApp switch */}
          <Grid item size={{ xs: 12, sm: gridSwitchSize }}>
            <CippFormComponent
              name="AsApp"
              type="switch"
              formControl={formControl}
              label="As App"
            />
          </Grid>
          <Grid item size={{ xs: 12, sm: gridSwitchSize }}>
            <CippFormComponent
              name="IsShared"
              type="switch"
              formControl={formControl}
              label="Share Preset"
            />
          </Grid>
        </Grid>
        <Divider sx={{ mt: 2, mb: 2 }} />
        <Stack spacing={1} direction={component === "accordion" ? "row" : "column"}>
          <Button variant="contained" color="primary" type="submit" startIcon={<PlayCircle />}>
            Apply Filter
          </Button>

          <Button
            variant="outlined"
            onClick={handleSavePreset}
            startIcon={<>{presetOwner ? <SaveIcon /> : <CopyAll />}</>}
          >
            {presetOwner ? "Save" : "Copy"} Preset
          </Button>

          {selectedPresetState && (
            <Button
              startIcon={<Delete />}
              variant="outlined"
              onClick={() => deletePreset(selectedPresetState)}
              disabled={!presetOwner}
            >
              Delete Preset
            </Button>
          )}

          <Button
            startIcon={<CalendarMonthTwoTone />}
            variant="outlined"
            onClick={handleScheduleReport}
          >
            Schedule Report
          </Button>

          <Button
            onClick={handleImport}
            variant="outlined"
            color="primary"
            startIcon={<ImportExport />}
          >
            Import/Export
          </Button>
        </Stack>

        <Grid item size={12}>
          <CippApiResults apiObject={savePresetApi} />
          <CippOffCanvas
            visible={offCanvasOpen}
            size="md"
            onClose={() => setOffCanvasOpen(false)}
            children={offCanvasContent}
          />
        </Grid>
      </CippButtonCard>
    </form>
  );
};

export default CippGraphExplorerFilter;