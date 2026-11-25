import {
  Button, Dropdown, Field, Menu, MenuItem, MenuItemCheckbox, MenuList, MenuPopover, MenuTrigger, Option,
  Popover, PopoverSurface, PopoverTrigger, Select,
} from '@fluentui/react-components'
import {
  ArrowSync16Regular, CalendarLtr16Regular, ChevronLeft20Regular, ChevronRight20Regular,
  Clock16Regular, Filter16Regular, MoreHorizontal20Regular,
} from '@fluentui/react-icons'
import { DEFAULT_PLANNING_VIEW } from './planning.js'

const VIEWS = [['timeGridDay', 'Day'], [DEFAULT_PLANNING_VIEW, 'Week'], ['dayGridMonth', 'Month']]

export default function CalendarToolbar({ calendar, period, mine, onScope, filters, hours, outlook, outlookStatus }) {
  const view = period?.view ?? DEFAULT_PLANNING_VIEW
  const { officers, selections, onOfficers, categories, category, onCategory } = filters
  const activeFilters = Number(Boolean(category)) + Number(!mine && selections.length > 0)
  const { phase, refresh } = outlook
  const showOptions = view !== 'dayGridMonth' || (mine && refresh)

  return (
    <section className="planning-toolbar" aria-label="Calendar controls">
      <div className="planning-date">
        <div className="planning-date-buttons" role="group" aria-label="Calendar dates">
          <Button type="button" aria-label="Previous period" title="Previous period"
            icon={<ChevronLeft20Regular />} onClick={() => calendar.current?.getApi().prev()} />
          <Button type="button" aria-label="Next period" title="Next period"
            icon={<ChevronRight20Regular />} onClick={() => calendar.current?.getApi().next()} />
          <Button type="button" onClick={() => calendar.current?.getApi().today()}>Today</Button>
        </div>
        <h2 id="planning-calendar-period" aria-live="polite">{period?.title ?? 'Calendar'}</h2>
      </div>
      <div className="planning-controls">
        <div className="planning-segment" role="group" aria-label="Calendar scope">
          <Button size="small" appearance="subtle" aria-label="My Calendar" aria-pressed={mine} onClick={() => onScope(true)}>
            My<span className="planning-scope-suffix"> calendar</span>
          </Button>
          <Button size="small" appearance="subtle" aria-label="Team Calendar" aria-pressed={!mine} onClick={() => onScope(false)}>
            Team<span className="planning-scope-suffix"> calendar</span>
          </Button>
        </div>
        <Select className="planning-view-select" size="small" aria-label="Calendar view" value={view}
          onChange={(_event, data) => calendar.current?.getApi().changeView(data.value)}>
          {VIEWS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </Select>
        <Popover positioning="below-end">
          <PopoverTrigger disableButtonEnhancement>
            <Button size="small" appearance={activeFilters ? 'secondary' : 'subtle'} icon={<Filter16Regular />}
              aria-label={activeFilters ? 'Filters, ' + activeFilters + ' active' : 'Filters'} title="Filters">
              <span className="planning-filter-label">Filters</span>
              {activeFilters > 0 && <span className="planning-filter-count" aria-hidden="true">{activeFilters}</span>}
            </Button>
          </PopoverTrigger>
          <PopoverSurface className="planning-filter-popover" aria-label="Calendar filters">
            <h3>Filters</h3>
            {!mine && (
              <Field label="Officers" size="small">
                <Dropdown size="small" multiselect inlinePopup placeholder="All officers" selectedOptions={selections}
                  value={officers.filter(({ id }) => selections.includes(id)).map(({ name }) => name).join(', ')}
                  onOptionSelect={(_event, data) => onOfficers(data.selectedOptions)}>
                  {officers.map(({ id, name }) => <Option key={id} value={id}>{name}</Option>)}
                </Dropdown>
              </Field>
            )}
            <Field label="Duty category" size="small">
              <Select value={category} onChange={(_event, data) => onCategory(data.value)}>
                <option value="">All categories</option>
                {categories.map((value) => <option key={value}>{value}</option>)}
              </Select>
            </Field>
            {activeFilters > 0 && (
              <Button size="small" appearance="subtle" onClick={() => { onCategory(''); if (!mine) onOfficers([]) }}>
                Clear filters
              </Button>
            )}
          </PopoverSurface>
        </Popover>
        {showOptions && (
          <Menu checkedValues={{ hours: hours.fullDay ? ['all'] : [] }}>
            <MenuTrigger disableButtonEnhancement>
              <Button size="small" appearance="subtle" icon={<MoreHorizontal20Regular />} aria-label="Calendar options"
                title={mine ? 'Calendar options · ' + outlookStatus : 'Calendar options'} />
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                {view !== 'dayGridMonth' && (
                  <MenuItemCheckbox name="hours" value="all" icon={<Clock16Regular />} disabled={hours.required}
                    title={hours.required ? 'The events in this view span these hours.' : undefined} onClick={hours.toggle}>
                    Show 24 hours
                  </MenuItemCheckbox>
                )}
                {mine && phase === 'disconnected' && refresh && (
                  <MenuItem icon={<CalendarLtr16Regular />} onClick={() => refresh(true)}>Connect Outlook</MenuItem>
                )}
                {mine && phase !== 'disconnected' && refresh && (
                  <MenuItem icon={<ArrowSync16Regular />} disabled={phase === 'loading'} onClick={() => refresh()}>Refresh Outlook</MenuItem>
                )}
              </MenuList>
            </MenuPopover>
          </Menu>
        )}
        {mine && (
          <span className="planning-outlook-status" data-state={outlook.truncated ? 'error' : phase} role="status" title={outlookStatus}>
            <i aria-hidden="true" /><span>{outlookStatus}</span>
          </span>
        )}
      </div>
    </section>
  )
}
